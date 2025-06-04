import express from "express";
import cors from 'cors'
import { app as gameboardApp } from './routes/gameboard.js'
import { app as dashBoardRoutes}  from './routes/dashboard.js'


const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use('/', gameboardApp)
app.use('/', dashBoardRoutes)

app.get("/", (req, res) => res.send("MyAPI"));


app.set('port', process.env.PORT || 3000);
app.listen(app.get('port'), () => {
    //console.log(bcrypt.hashSync('x',10))
    console.log(`app escuchando en el puerto ${app.get('port')}`);
});
