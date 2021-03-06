const express = require("express");
const { renderSync } = require("sass");
const router = express.Router();

module.exports = (db) => {
  //View all stories
  router.get("/", (req, res) => {
    const queryString = `
      SELECT stories.*, users.name, users.avatar
        FROM stories
        JOIN users on stories.user_id = users.id
        ORDER BY id`;
    db.query(queryString)
      .then((data) => {
        const templateVars = { data: data.rows };
        res.render("stories/stories_index", templateVars);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  router.get("/new", (req, res) => {
    res.render("stories/stories_new");
  });

  //View all in-progress stories
  router.get("/inprogress", (req, res) => {
    const queryString = `
      SELECT *
        FROM stories
        WHERE complete = FALSE
        ORDER BY id DESC;`;
    db.query(queryString)
      .then((data) => {
        const templateVars = { data: data.rows };
        res.render("stories/stories_index", templateVars);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  //View all completed stories
  router.get("/complete", (req, res) => {
    const queryString = `
      SELECT *
        FROM stories
        WHERE complete = TRUE
        ORDER BY id DESC;`;
    db.query(queryString)
      .then((data) => {
        const templateVars = { data: data.rows };
        res.render("stories/stories_index", templateVars);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  //View one story, accepted contributions, and pending contributions
  router.get("/:id", (req, res) => {
    const queryString =
      `SELECT contributions.*, contributions.id AS contribution_id, stories.*, users.name AS creator_name, users.avatar, count(contribution_votes.contribution_id) AS votes
        FROM users
        JOIN stories ON users.id = stories.user_id
        LEFT JOIN contributions ON stories.id = contributions.story_id
        LEFT JOIN contribution_votes ON contributions.id = contribution_votes.contribution_id
        WHERE stories.id = $1
        GROUP BY contributions.id, stories.id, creator_name, users.avatar;`;

    db.query(queryString, [req.params.id])
      .then((data) => {
        const templateVars = { data: data.rows };
        const secondQueryString = `SELECT users.name as contributor, users.avatar as contributor_avatar, contributions.id as contribution_id
        FROM users
        JOIN contributions ON users.id = contributions.user_id
        JOIN stories ON contributions.story_id = stories.id
        WHERE stories.id = $1;`
        db.query(secondQueryString, [req.params.id])
        .then((new_data) => {
          for (user of new_data.rows) {
            for (let obj = 0; obj < templateVars.data.length; obj++) {
              if (user.contribution_id === templateVars.data[obj]['contribution_id']) {
                templateVars.data[obj]['contributor'] = user.contributor;
                templateVars.data[obj]['contributor_avatar'] = user.contributor_avatar;
              }
            }
          }
          res.render("stories/stories_show", templateVars);
        })
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  //View all pending contributions for story
  router.get("/:id/contributions", (req, res) => {
    const queryString = `
      SELECT contributions.*, users.name, count(contribution_votes.contribution_id) AS votes
        FROM contribution_votes
        RIGHT JOIN contributions ON contribution_id = contributions.id
        JOIN users ON contributions.user_id = users.id
        WHERE contributions.story_id = $1
        AND contributions.accepted = FALSE
        AND contributions.archived = FALSE
        GROUP BY contributions.id, users.name, contribution_votes.contribution_id, contributions.content, contributions.user_id
        ORDER BY votes DESC;`;
    db.query(queryString, [req.params.id])
      .then((data) => {
        const templateVars = { data: data.rows };
        res.render("stories/stories_contributions", templateVars);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  ///////////// POST ROUTES /////////////////
  ///////////////////////////////////////////

  //CREATE A NEW STORY
  router.post("/new", (req, res) => {
    const { title, initialContent } = req.body;
    const queryParams = [title, initialContent];
    const queryString = `
          INSERT INTO stories (user_id, title, initial_content)
          VALUES (1, $1, $2)
          RETURNING *;`;
    const query = {
      text: queryString,
      values: queryParams,
    };

    db.query(query)
      .then((data) => {
        res.redirect(`/stories/${data.rows[0].id}`);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  //ACCEPT CONTRIBUTION
  router.post("/contributions/:id", (req, res) => {
    const queryParams = [Number(req.params.id)];
    const queryString1 = `
      SELECT story_id
        FROM contributions
        WHERE id = $1`
    const queryString2 = `
      UPDATE contributions
        SET archived = TRUE
        WHERE id != $1
        AND story_id = $2
        AND accepted = FALSE
        RETURNING *;`;
    const queryString3 = `
      UPDATE contributions
        SET accepted = TRUE
        WHERE id = $1
        RETURNING *;`;

    db.query(queryString1, queryParams)
      .then((data) => {
        const queryParams2 = [Number(req.params.id), data.rows[0].story_id];
        db.query(queryString2, queryParams2)
          .then(db.query(queryString3, queryParams)
          .then((data) => {
          res.redirect(`/stories/${data.rows[0].story_id}`);
        }))
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  // UPVOTE CONTRIBUTION
  router.post("/contributions/:id/vote", (req, res) => {
    const queryParams = [Number(req.params.id)];
    const queryString = `
        INSERT INTO contribution_votes (user_id, contribution_id, story_id)
        VALUES (1, $1, (SELECT story_id
          FROM contributions
          WHERE id = $1))
        RETURNING *;`;

    db.query(queryString, queryParams)
      .then((data) => {
        res.redirect(`/stories/${data.rows[0].story_id}/#submissions`);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

    //FINALIZE STORY
    router.post("/:id", (req, res) => {
      const queryParams = [Number(req.params.id)];
      const queryString = `
        UPDATE stories
          SET complete = TRUE
          WHERE id = $1
          RETURNING *;`;
      const query = {
        text: queryString,
        values: queryParams,
      }
      db.query(query)
        .then((data) => {
          res.redirect(`/stories/${data.rows[0].id}`);
        })
        .catch((err) => {
          res.status(500).json({ error: err.message });
        });
    });

  //CREATE NEW CONTRIBUTION
  router.post("/:id/contributions", (req, res) => {
    const { content } = req.body;
    const story_id = Number(req.params.id);

    const queryParams = [story_id, content];
    const queryString = `
        INSERT INTO contributions (user_id, story_id, content)
        VALUES (1, $1, $2)
        RETURNING *;
      `;
    const query = {
      text: queryString,
      values: queryParams,
    }
    db.query(query)
      .then((data) => {
        res.redirect(`/stories/${story_id}/#submissions`);
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });


  return router;
};
