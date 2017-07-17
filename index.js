const env = require("dotenv").load().parsed
const express = require("express")
const expressNunjucks = require("express-nunjucks")
const mysql = require("promise-mysql")
const moment = require("moment")

const requireEnvVars = [
    "DB_HOST",
    "DB_PASSWORD",
    "DB_USERNAME"
]

console.log(env)

for (const v of requireEnvVars) {
  if (env[v] == null) {
      throw new Error(`A configuration key is missing: ${v}`)
  }
}

function openDB() {
  return mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: "centreon_storage"
  })
}

const app = express()
const port = env.PORT || 3000

app.set("views", `${__dirname}/templates`)

const isDev = app.get('env') === "development"

expressNunjucks(app, {
  watch: isDev,
  noCache: isDev
})

states = {
  0: "OK",
  1: "WARNING",
  2: "CRITICAL",
  3: "UNKNOWN"
}

bsStates = {
  0: "label-success",
  1: "label-warning",
  2: "label-danger",
  3: "label-default"
}

// service_id 3 is Derek.
const sqlMostRecent = `\
SELECT 
  FROM_UNIXTIME(sse.start_time) as call_start,
  FROM_UNIXTIME(sse.end_time) as call_end,
  sse.state,
  s.description 
FROM servicestateevents sse
JOIN services s ON sse.service_id = s.service_id
WHERE sse.service_id <> 3
ORDER BY call_start DESC
LIMIT 100`

app.get("/most-recent", (req, res, next) => {
  openDB()
    .then(db => {
      return db.query(sqlMostRecent)
    })
    .then(raw => {
      const rows = raw.map(r => {
        console.log(r)
        return {
          service: r.description,
          status: states[r.state],
          bsClass: bsStates[r.state],
          duration: moment(r.call_end).to(r.call_start, true),
          dateTime: moment(r.call_start).format("DD MMMM YYYY, HH:mm:ss Z")
        }
      })

      res.render("most-recent", { rows })
    })
    .catch(err => {
      next(err)
    })
})

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})