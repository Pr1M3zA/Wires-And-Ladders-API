import express from "express";
import cors from 'cors'
import {connect} from './../db.js'

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

app.get('/gamesbyplatform', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query('SELECT cant AS value, platform_name as text FROM vw_games_by_platform')
        console.log(rows)
        res.status(200).json(rows)
    } catch(err) {
        console.error('Ocurrió un error al obtener los juegos por plataforma');
        res.status(500).json({ error: 'Ocurrió un error al obtener los juegos por plataforma' });
    } finally {
        if (db) await db.end();
    }   
});

export {app}