import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('money_manager.db');
db.serialize(() => {
  db.run("ALTER TABLE transactions ADD COLUMN time TEXT DEFAULT ''", (err) => {
    if(err) console.log(err.message);
    else console.log("Added time to transactions");
  });
  db.run("ALTER TABLE deleted_transactions ADD COLUMN time TEXT DEFAULT ''", (err) => {
    if(err) console.log(err.message);
    else console.log("Added time to deleted_transactions");
  });
});
