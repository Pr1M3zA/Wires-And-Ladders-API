import express from "express";
import cors from 'cors'
import {connect} from './../db.js'

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

app.get('/dashboard/games-by-platform', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query('SELECT cant AS value, platform_name as label, cant as text FROM vw_games_by_platform')
        res.status(200).json(rows)
    } catch(err) {
        console.error('Ocurrió un error al obtener los juegos por plataforma');
        res.status(500).json({  error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/games-by-month', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query('SELECT cant AS value, Mes as label, cant as text FROM vw_games_by_month')
        res.status(200).json(rows)
    } catch(err) {
        console.error('Ocurrió un error al obtener los juegos por plataforma');
        res.status(500).json({  error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/games-by-dayofweek', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query('SELECT cant AS value, DayOfWeek as label, cant as text FROM vw_games_by_dayofweek')
        res.status(200).json(rows)
    } catch(err) {
        console.error('Ocurrió un error al obtener los juegos por plataforma');
        res.status(500).json({  error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/top-wins/:limit', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query(`SELECT userName, totWins FROM vw_user_wins LIMIT ${req.params.limit}`)
        res.status(200).json(rows)
    } catch(err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/top-points/:limit', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query(`SELECT userName, totPoints FROM vw_user_points LIMIT ${req.params.limit}`)
        res.status(200).json(rows)
    } catch(err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/top-games-started/:limit', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query(`SELECT userName, TotGamesStarted FROM vw_user_games_started LIMIT ${req.params.limit}`)
        res.status(200).json(rows)
    } catch(err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.end();
    }   
});

app.get('/dashboard/played-minutes', async (req, res) => {
    let db;
    try {
        db = await connect();
        const [rows] = await db.query(`SELECT ROUND(SUM(TIME_TO_SEC(TIMEDIFF(date_time_end, date_time_start))/60),0) played_minutes FROM game_logs`)
        res.status(200).json(rows)
    } catch(err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.end();
    }   
});






export {app}