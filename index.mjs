import express from 'express';
import mysql from 'mysql2/promise';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

//for Express to get values using POST method
app.use(express.urlencoded({extended:true}));

//setting up database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10,
    waitForConnections: true
});

//routes
app.get('/',  (req, res) => {
    res.render('index'); 
});

app.get("/authors", async function(req, res){
let sql = `SELECT *
        FROM q_authors
        ORDER BY lastName`;
const [rows] = await pool.query(sql);
res.render("authorList", {"authors":rows});
});

app.get("/author/new", (req, res) => {
    res.render("newAuthor");
});


//display form for input author information
app.post("/author/new", async function(req, res){
  let fName = req.body.fName;
  let lName = req.body.lName;
  let birthDate = req.body.birthDate;
  let birthDeath = req.body.birthDeath;
  let sex = req.body.sex;
  let profession = req.body.profession;
  let country = req.body.country;
  let portrait = req.body.portrait;
  let biography = req.body.biography;
  let sql = `INSERT INTO q_authors
             (firstName, lastName, dob, dod, sex, profession, country, portrait, biography)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const birthDeathValue = (req.body.birthDeath === "" ? null : req.body.birthDeath);
  let params = [fName, lName, birthDate, birthDeathValue, sex, profession, country, portrait, biography];
  const [rows] = await pool.query(sql, params);
  res.render("newAuthor", 
             {"message": "Author added!"});
});

app.get("/author/edit", async function(req, res){

 const authorId = req.query.authorId;

 const sql = `SELECT 
        authorId, firstName, lastName, sex,
        profession, country, portrait, biography,
        DATE_FORMAT(dob, '%Y-%m-%d') AS dobISO,
        IFNULL(DATE_FORMAT(dod, '%Y-%m-%d'), '') AS dodISO
        FROM q_authors
        WHERE authorId =  ? `;
 const [rows] = await pool.query(sql, [authorId]);
 res.render("editAuthor", {"authorInfo":rows});
});

app.post("/author/edit", async function(req, res){
  let sql = `UPDATE q_authors
            SET firstName = ?,
                lastName = ?,
                dob = ?,
                dod = ?,
                sex = ?,
                profession = ?,
                country = ?,
                portrait = ?,
                biography = ?
            WHERE authorId = ?`;

  const birthDeathValue = (req.body.birthDeath === "" ? null : req.body.birthDeath);          

  let params = [req.body.fName,
    req.body.lName,
    req.body.birthDate,
    birthDeathValue,
    req.body.sex,
    req.body.profession,
    req.body.country,
    req.body.portrait,
    req.body.biography,
    req.body.authorId];  
           
    await pool.query(sql,params);
    res.redirect("/authors");
});

app.get("/author/delete", async function(req, res) {
    let authorId = req.query.authorId;

    let sql = `DELETE
                FROM q_authors
                WHERE authorId = ?`;
    
    const [rows] = await pool.query(sql, [authorId]);
    res.redirect("/authors");
});

//ADDITIONAL REQUIREMENTS: list all quotes and add links to update and delete each one
app.get("/quotes", async (req, res) => {
  const sql = `
    SELECT q.quoteId, q.quote, q.category, q.likes,
           a.firstName, a.lastName
    FROM q_quotes q
    JOIN q_authors a ON q.authorId = a.authorId
    ORDER BY q.quoteId
  `;
  const [rows] = await pool.query(sql);
  res.render("quoteList", { quotes: rows });
});

//ADDITIONAL REQ: Implement routes to update quotes, display the pre-populated form
app.get("/quote/edit", async (req, res) => {
  const quoteId = req.query.quoteId;

  const quoteSql = `
    SELECT quoteId, quote, authorId, category, likes
    FROM q_quotes
    WHERE quoteId = ?
  `;
  const authorsSql = `
    SELECT authorId, firstName, lastName
    FROM q_authors
    ORDER BY lastName
  `;

  const categoriesSql = `
    SELECT DISTINCT category
    FROM q_quotes
    ORDER BY category
  `;

  const [[quoteRows], [authorRows], [categoryRows]] = await Promise.all([
    pool.query(quoteSql, [quoteId]),
    pool.query(authorsSql),
    pool.query(categoriesSql)
  ]);

  res.render("editQuote", {
    quoteInfo: quoteRows,   
    authors: authorRows,
    categories: categoryRows
  });
});

// update quote
app.post("/quote/edit", async (req, res) => {
  const sql = `
    UPDATE q_quotes
    SET quote = ?,
        authorId = ?,
        category = ?,
        likes = ?
    WHERE quoteId = ?
  `;

  const likesVal = (req.body.likes === "" ? null : req.body.likes);

  const params = [
    req.body.quote,
    req.body.authorId,
    req.body.category,
    likesVal,
    req.body.quoteId
  ];

  await pool.query(sql, params);
  res.redirect("/quotes");
});

//ADDITIONAL REQ: Implement a route to delete quotes
app.get("/quote/delete", async (req, res) => {
  const quoteId = req.query.quoteId;
  const sql = `DELETE FROM q_quotes 
                WHERE quoteId = ?`;
  await pool.query(sql, [quoteId]);
  res.redirect("/quotes");
});

// show form to add a new quote (second button in index)
app.get("/quote/new", async (req, res) => {
  const authorsSql = `
    SELECT authorId, firstName, lastName
    FROM q_authors
    ORDER BY lastName
  `;

  const categoriesSql = `
    SELECT DISTINCT category
    FROM q_quotes
    ORDER BY category
  `;

  const [[authors], [categories]] = await Promise.all([
    pool.query(authorsSql),
    pool.query(categoriesSql)
  ]);

  res.render("newQuote", { authors, categories, message: null });
});

// INSERT new quote (all fields except quoteId)
app.post("/quote/new", async (req, res) => {
  const sql = `
    INSERT INTO q_quotes (quote, authorId, category, likes)
    VALUES (?, ?, ?, ?)
  `;

  const likesVal = (req.body.likes === "" ? null : req.body.likes);
  const params = [req.body.quote, req.body.authorId, req.body.category, likesVal];

  await pool.query(sql, params);

  // reload authors and categories so dropdown still works after submit
  const [[authors], [categories]] = await Promise.all([
  pool.query(`
    SELECT authorId, firstName, lastName
    FROM q_authors
    ORDER BY lastName
  `),
  pool.query(`
    SELECT DISTINCT category
    FROM q_quotes
    ORDER BY category
  `)
]);

  res.render("newQuote", { authors, categories, message: "Quote added!" });
});

// app.get("/dbTest", async(req, res) => {
//    let sql = "SELECT CURDATE()";
//    const [rows] = await pool.query(sql);
//    res.send(rows);
// });

// app.get("/dbTest", async(req, res) => {
//    try {
//         const [rows] = await pool.query("SELECT CURDATE()");
//         res.send(rows);
//     } catch (err) {
//         console.error("Database error:", err);
//         res.status(500).send("Database error");
//     }
// });//dbTest

app.listen(process.env.PORT || 3000, ()=>{
    console.log("Express server running")
})