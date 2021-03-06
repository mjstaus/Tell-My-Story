/*
 * All routes for Users are defined here
 * Since this file is loaded in server.js into api/users,
 *   these routes are mounted onto /users
 * See: https://expressjs.com/en/guide/using-middleware.html#middleware.router
 */

const express = require("express");
const router = express.Router();

module.exports = (db) => {
  //Show dashboard for given user
  router.get("/:id/dashboard", (req, res) => {
    res.render("users/dashboard");
  });

  //Show User's Stories
  router.get("/:id/stories", (req, res) => {
    const queryString1 = `
    SELECT stories.*, users.name, users.avatar
      FROM stories
      JOIN users ON stories.user_id = users.id
      WHERE user_id = $1
      GROUP BY stories.id, users.name, users.avatar;`;

    const queryString2 = `
      SELECT COUNT(stories.complete) FILTER (WHERE stories.complete) AS stories_complete, COUNT(stories.complete) FILTER (WHERE NOT stories.complete) AS stories_in_progress, COUNT(stories.id) AS stories_total
        FROM stories
        WHERE user_id = $1;`;

    db.query(queryString1, [req.params.id])
      .then((data) => {
        db.query(queryString2, [req.params.id]).then((data2) => {
          const templateVars = { data: data.rows, stats: data2.rows };
          console.log(templateVars);
          res.render("users/users_stories", templateVars);
        });
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });

  //

  //Show User's Contributions
  router.get("/:id/contributions", (req, res) => {
    const queryString1 = `SELECT contributions.*, users.name, users.avatar
        FROM contributions
        JOIN users ON contributions.user_id = users.id
        WHERE user_id = $1;`;

    const queryString2 = `
      SELECT COUNT(contributions.accepted) FILTER (WHERE contributions.accepted) AS contributions_accepted, COUNT(contributions.id) AS contributions_total, COUNT(contributions.archived) AS contributions_archived
        FROM contributions
        WHERE user_id = $1;`;

    const queryString3 = `
      SELECT contribution_votes.contribution_id, COUNT(contribution_votes.id) AS count
        FROM contributions
        JOIN contribution_votes ON contribution_votes.contribution_id = contributions.id
        GROUP BY contribution_votes.contribution_id`;
//want contribution
    db.query(queryString1, [req.params.id]).then((data) => {
      db.query(queryString2, [req.params.id]).then((data2) => {
        db.query(queryString3)
          .then((data3) => {
            const templateVars = {
              data: data.rows,
              stats: data2.rows
            };
            console.log(data3.rows);
            for (d of data3.rows) {
              for (let i = 0; i < templateVars.data.length; i++) {
                if (
                  d.contribution_id ===
                  templateVars.data[i]["id"]
                ) {
                  templateVars.data[i]["votes"] = d.count;
                }
              }
            }
            res.render("users/users_contributions", templateVars);
          })
          .catch((err) => {
            res.status(500).json({ error: err.message });
          });
      });
    });
  });
  return router;
};
