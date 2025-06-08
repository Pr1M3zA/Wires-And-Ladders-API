import express from "express";
import cors from 'cors'
import { Resend } from "resend";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { connect } from './../db.js'


const resend = new Resend(process.env.MAIL_APIKEY);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());


app.get('/users', async (req, res) => {
	let db;
	try {

		db = await connect();
		const [rows] = await db.query('SELECT username, first_name, last_name, email, password, activo FROM users');
		res.status(200).json(rows);
	} catch (err) {
		console.error('Ocurrió un error al obtener los usuarios');
		res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" });
	} finally {
		if (db) await db.end();
	}
});


app.get('/user', checkToken, async (req, res) => {
	let db;
	try {
		//console.log(req.params)
		db = await connect();
		const query = `SELECT id, username, first_name, last_name, email, profile_image, IFNULL(isAdmin,0) isAdmin FROM users WHERE id=${req.idUser}`;
		const [userRow] = await db.execute(query);
		if (userRow.length === 0)
			throw new Error('No se encontró el usuario');
		res.status(200).json({ userRow })
	} catch (err) {
		return res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" })
	} finally {
		if (db) await db.end();
	}
});


app.post('/user', async (req, res) => {
	console.log('add user')
	let db;
	const saltRounds = 10;
	try {
		db = await connect();
		const { username, first_name, last_name, email, password, profile_image } = req.body;
		const hashPassword = bcrypt.hashSync(password, saltRounds);
		let query = `CALL SP_CREATE_USER('${username}', '${first_name}', '${last_name}', '${email}', '${hashPassword}', '${profile_image}')`;
		const [result] = await db.execute(query);
		res.status(200).json(result)
	} catch (err) {
		console.log(err)
		return res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" })
	} finally {
		if (db) await db.end();
	}
});


app.put('/user', checkToken, async (req, res) => {
	let db;
	try {
		db = await connect();
		const { first_name, last_name, password, profile_image } = req.body;
		const idUser = req.idUser;
		let query = `UPDATE users SET first_name='${first_name}', last_name='${last_name}', profile_image='${profile_image}'`
		if (password.length > 0) {
			const saltRounds = 10;
			const hashPassword = bcrypt.hashSync(password, salt)
			query += `, password='${hashPassword}'`
		}
		query += ` WHERE id=${idUser}`
		const [result] = await db.execute(query);
		res.status(200).json(result)
	} catch (err) {
		return res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" })
	} finally {
		if (db) await db.end();
	}
});

app.post('/login', async (req, res) => {
	let db;
	try {
		const { identifier, password } = req.body
		db = await connect();
		let idUser = 0;
		const query = `SELECT id, password FROM users WHERE username ='${identifier}' OR email='${identifier}'`;
		const [rows] = await db.execute(query);
		if (rows.length > 0) {
			if (bcrypt.compareSync(password, rows[0].password))
				idUser = rows[0].id
			else
				throw new Error('Contraseña incorrecta');
		}
		else
			throw new Error('El usuario no existe');
		const token = jwt.sign({ idUser }, process.env.SECRET, { expiresIn: '1d' })
		res.status(200).json({ token: token })
	} catch (err) {
		return res.status(500).json({ message: err.message })
	} finally {
		if (db)
			db.end();
	}
});

app.post('/send-reset-code', async (req, res) => {
	let db;
	const saltRounds = 10;
	try {
		const { identifier } = req.body
		db = await connect();
		let idUser = 0, email = '';
		const query = `SELECT id, first_name, last_name, email FROM users WHERE username ='${identifier}' OR email='${identifier}'`;
		const [rows] = await db.execute(query);
		if (rows.length > 0) {
			idUser = rows[0].id
			email = rows[0].email
			const code = makeCode()
			const { data, error } = await resend.emails.send({
				from: 'Wires and Ladder Support <wireladder@wiresandladder.com>',
				to: [email],
				subject: 'Recuperación de Contraseña - Wires and Ladder',
				html: `
                        <p>Estimado(a) ${rows[0].first_name}:</p>
                        <p></p>
                        <p>Ha recibido este correo, ya que solicitó recuperar la contraseña de nuestra aplicación 
                            <strong>Wires and Ladders</strong>
                        </p>
                        <p></p>
                        <p>A continuación, le proporcionamos el código que deberá ingresar en la aplicación en la sección de recuperación de contraseña:</p>
                        <p></p>
                        <h1><strong><center>${code}</center></strong></h1>
                        <p></p>
                        <p>Luego de introducir el código, podrá establecer una nueva contraseña.</p>
                        <p></p>
                        <p>Saludos cordiales!</p>
                        <p></p>
                        <p><strong>Wires and Ladders</strong></p>
                    `,
			});
			if (error) {
				console.log(error)
				throw new Error(error);
			}
			const hashedCode = bcrypt.hashSync(code, saltRounds);
			await db.execute(`UPDATE users SET code_pass_recover = '${hashedCode}' WHERE id = ${idUser}`)
			res.status(200).json({ email: email, message: 'Codigo enviado correctamente al correo electrónico' })
		}
		else
			res.status(404).json({ message: 'El usuario no existe' })
	} catch (err) {
		return res.status(500).json({ err })
	} finally {
		if (db)
			db.end();
	}
});


app.post('/verify-reset-code', async (req, res) => {
	let db;
	try {
		const { identifier, code } = req.body
		db = await connect();
		let idUser = 0;
		const query = `SELECT id, IFNULL(code_pass_recover, 'nocode') code_pass_recover FROM users WHERE username ='${identifier}' OR email='${identifier}'`;
		const [rows] = await db.execute(query);
		if (rows.length > 0) {
			if (!bcrypt.compareSync(code, rows[0].code_pass_recover))
				res.status(401).json({ message: 'Código de recuperación incorrecto' })
			else
				idUser = rows[0].id
			const token = jwt.sign({ idUser }, process.env.SECRET, { expiresIn: '1d' })
			res.status(200).json({ token: token })
		}
		else
			res.status(404).json({ message: 'El usuario no existe' })
	} catch (err) {
		return res.status(500).json({ message: err.message })
	} finally {
		if (db)
			db.end();
	}
});



app.post('/reset-password', checkToken, async (req, res) => {
	let db;
	const saltRounds = 10;
	try {
		db = await connect();
		const { newPassword } = req.body;
		const hashPassword = bcrypt.hashSync(newPassword, saltRounds);
		const [result] = await db.execute(`UPDATE users SET password = '${hashPassword}' WHERE id = ${req.idUser}`);
		res.status(200).json(result)
	} catch (err) {
		console.log(err)
		return res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" })
	} finally {
		if (db) await db.end();
	}
});


app.post('/game-stats', checkToken, async (req, res) => {
	let db;
	try {
		db = await connect();
		const { startTime, endTime, winnerUserId, players } = req.body;
		console.log(startTime, endTime, winnerUserId, players)
		const query = `INSERT INTO game_logs (date_time_start, date_time_end, winner_user_id) VALUES ('${startTime}', '${endTime}', ${winnerUserId})`
		const [result] = await db.execute(query);
		const gameLogId = result.insertId;
		for (const player of players) {
			if(player.dbUserId > 0) {  // Ignoramos a los guest
				let idPlatform = 1; // ios
				if (player.platform === 'android') idPlatform = 2; // android
				if (player.platform === 'web') idPlatform = 3; // web
				const query = `INSERT INTO gamer_logs (id_game, id_user, platform, rolled_dice, points_earned, ladders, wires, ok_question_tiles, special_tiles, positive_tiles, negative_tiles, info_tiles, question_tiles)
							VALUES (${gameLogId}, ${player.dbUserId}, ${idPlatform}, ${player.diceRolls}, ${player.pointsAccumulated}, ${player.laddersTaken}, ${player.snakesTaken}, ${player.correctAnswers},
									${player.landedOnTileCounter.Especial}, ${player.landedOnTileCounter.Positivo}, ${player.landedOnTileCounter.Negativo}, ${player.landedOnTileCounter.Informativo}, ${player.landedOnTileCounter.Pregunta})`
				await db.execute(query);
			}
		}
		res.status(200).json({message: 'Juego registrado correctamente'})
	} catch (err) {
		console.log(err)
		return res.status(500).json({ message: db ? err.sqlMessage : "DB connection issue" })
	} finally {
		if (db) await db.end();
	}



});

function makeCode() {
	let codigo = '';
	for (let i = 0; i < 5; i++) {
		const ascii = Math.floor(Math.random() * (90 - 65 + 1)) + 65;
		codigo += String.fromCharCode(ascii);
	}
	return codigo;
}

function checkToken(req, res, next) {
	const token = req.headers['authorization'];
	if (typeof token === 'undefined')
		res.sendStatus(403)
	else {
		const tokenData = jwt.verify(token, process.env.SECRET, (err, data) => {
			if (err)
				res.sendStatus(403);
			else
				req.idUser = data.idUser
		})
		next();
	}
}

export { app }