require('dotenv').config();
const mysql = require('mysql2');

// passando as variáveis de ambiente
const connection = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER, 
  password: process.env.PASS,
  database: process.env.DB,
  port: process.env.DB_PORT || 3306,
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao MySQL:', err);
  } else {
    console.log('🟢 Conectado ao MySQL com sucesso!');
  }
});

module.exports = connection;