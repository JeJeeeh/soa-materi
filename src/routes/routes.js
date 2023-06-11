import { Router } from "express";
import Joi from "joi";
import database from "../databases/connection.js";
import { QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import secret from "../config/secret_key.js";
import { hasApiToken, isAdmin, isUser } from "../middlewares/middlewares.js";
const router = Router();

router.post("/login", async (req, res) => {
	const { username, display_name, password } = req.body;

	const schema = Joi.object({
		username: Joi.string().required(),
		display_name: Joi.string(),
		password: Joi.string().required(),
	});

	try {
		await schema.validateAsync({
			username: username,
			password: password,
		});
	} catch (error) {
		return res.status(400).send(error.details[0].message);
	}

	if (display_name) {
		const userFound = await database.query(
			`SELECT * FROM users WHERE username = '${username}'`,
			{
				type: QueryTypes.SELECT,
			}
		);

		if (userFound.length > 0) {
			return res.status(400).send({
				status: 400,
				message: "Username already taken",
			});
		}

		const counter = await database.query(`SELECT COUNT(*) FROM users`, {
			type: QueryTypes.SELECT,
		});

		const idPrefix = counter[0]["COUNT(*)"] + 1;
		const id = `U${idPrefix.toString().padStart(3, "0")}`;

		await database.query(
			`INSERT INTO users (id, username, display_name, password, tier_id) VALUES ('${id}', '${username}', '${username}', '${password}', 0)`,
			{
				type: QueryTypes.INSERT,
			}
		);

		const token = jwt.sign({ id: id, role: "user" }, secret, {
			expiresIn: "1h",
		});

		return res.status(201).send({
			status: 201,
			body: {
				user_id: id,
				username: username,
				display_name: display_name,
				token: token,
			},
		});
	} else {
		if (username == "admin" && password == "panloose") {
			const token = jwt.sign({ id: "admin", role: "admin" }, secret, {
				expiresIn: "1h",
			});

			return res.status(200).send({
				status: 200,
				body: {
					username: "admin",
					token: token,
				},
			});
		}

		const user = await database.query(
			`SELECT * FROM users WHERE username = '${username}'`,
			{
				type: QueryTypes.SELECT,
			}
		);

		if (user.length == 0) {
			return res.status(400).send({
				status: 400,
				message: "User not found",
			});
		}

		if (user[0].password != password) {
			return res.status(400).send({
				status: 400,
				message: "Wrong password",
			});
		}

		const token = jwt.sign({ id: user[0].id, role: "user" }, secret, {
			expiresIn: "1h",
		});

		return res.status(200).send({
			status: 200,
			body: {
				username: user[0].username,
				token: token,
			},
		});
	}
});

router.post("/items", hasApiToken, isAdmin, async (req, res) => {
	const { name, price } = req.body;

	const schema = Joi.object({
		name: Joi.string().required(),
		price: Joi.number().required(),
	});

	try {
		await schema.validateAsync({
			name: name,
			price: price,
		});
	} catch (error) {
		return res.status(400).send(error.details[0].message);
	}

	const counter = await database.query(`SELECT COUNT(*) FROM items`, {
		type: QueryTypes.SELECT,
	});

	const idPrefix = counter[0]["COUNT(*)"] + 1;
	const id = `I${idPrefix.toString().padStart(3, "0")}`;

	await database.query(
		`INSERT INTO items (id, name, price) VALUES ('${id}', '${name}', ${price})`,
		{
			type: QueryTypes.INSERT,
		}
	);

	return res.status(201).send({
		status: 201,
		body: {
			item_id: id,
			name: name,
			price: price,
		},
	});
});

router.post("/tiers", hasApiToken, isAdmin, async (req, res) => {
	const { name, price, benefit_token } = req.body;

	const schema = Joi.object({
		name: Joi.string().required(),
		price: Joi.number().required(),
		benefit_token: Joi.number().required(),
	});

	try {
		await schema.validateAsync({
			name: name,
			price: price,
			benefit_token: benefit_token,
		});
	} catch (error) {
		return res.status(400).send(error.details[0].message);
	}

	const counter = await database.query(`SELECT COUNT(*) FROM tiers`, {
		type: QueryTypes.SELECT,
	});

	const idPrefix = counter[0]["COUNT(*)"] + 1;
	const id = `T${idPrefix.toString().padStart(3, "0")}`;

	await database.query(
		`INSERT INTO tiers (id, name, price, benefit_token) VALUES ('${id}', '${name}', ${price}, ${benefit_token})`,
		{
			type: QueryTypes.INSERT,
		}
	);

	return res.status(201).send({
		status: 201,
		body: {
			tier_id: id,
			name: name,
			price: price,
			benefit_token: benefit_token,
		},
	});
});

router.put("/users/:user_id", hasApiToken, isUser, async (req, res) => {
	const { user_id } = req.params;
	const { add_balance } = req.body;

	const schema = Joi.object({
		add_balance: Joi.number().required(),
	});

	try {
		await schema.validateAsync({
			add_balance: add_balance,
		});
	} catch (error) {
		return res.status(400).send(error.details[0].message);
	}

	const user = await database.query(
		`SELECT * FROM users WHERE id = '${user_id}'`,
		{
			type: QueryTypes.SELECT,
		}
	);

	if (user.length == 0) {
		return res.status(400).send({
			status: 400,
			message: "User not found",
		});
	}

	const oldBalance = parseInt(user[0].balance);
	const newBalance = parseInt(user[0].balance) + parseInt(add_balance);

	await database.query(
		`UPDATE users SET balance = ${newBalance} WHERE id = '${user_id}'`,
		{
			type: QueryTypes.UPDATE,
		}
	);

	return res.status(200).send({
		status: 200,
		body: {
			user_id: user_id,
			prev_balance: oldBalance,
			new_balance: newBalance,
		},
	});
});

router.post("/benefits", hasApiToken, isAdmin, async (req, res) => {
	const reqBody = { ...req.body };

	const schema = Joi.object({
		name: Joi.string().required(),
		eligible_tier: Joi.string().required(),
		item_id: Joi.string().required(),
	});

	try {
		await schema.validateAsync({
			name: reqBody.name,
			eligible_tier: reqBody.eligible_tier,
			item_id: reqBody.item_id,
		});
	} catch (error) {
		return res.status(400).send(error.details[0].message);
	}

	const validTier = await database.query(
		`SELECT * FROM tiers WHERE id = '${reqBody.eligible_tier}'`,
		{
			type: QueryTypes.SELECT,
		}
	);

	if (validTier.length == 0) {
		return res.status(400).send({
			status: 400,
			message: "Tier not found",
		});
	}

	if (!reqBody.disc_flat && !reqBody.disc_perc && !reqBody.free_item_id) {
		return res.status(400).send({
			status: 400,
			message: "Fill at least one benefit",
		});
	}

	if (!validItem(reqBody.item_id)) {
		return res.status(400).send({
			status: 400,
			message: "Item not found",
		});
	}

	const buy_item = await database.query(
		`SELECT * FROM items WHERE id = '${reqBody.item_id}'`,
		{
			type: QueryTypes.SELECT,
		}
	);

	if (reqBody.free_item_id) {
		if (!validItem(reqBody.free_item_id)) {
			return res.status(400).send({
				status: 400,
				message: "Item not found",
			});
		}

		// false
		if (!reqBody.buy_qty || !reqBody.get_qty) {
			return res.status(400).send({
				status: 400,
				message: "Incomplete promo form",
			});
		} // true
		else {
			const schema = Joi.object({
				buy_qty: Joi.number().min(0).required(),
				get_qty: Joi.number().min(0).required(),
			});

			try {
				await schema.validateAsync({
					buy_qty: reqBody.buy_qty,
					get_qty: reqBody.get_qty,
				});
			} catch (error) {
				return res.status(400).send(error.details[0].message);
			}

			const counter = await database.query(`SELECT COUNT(*) FROM benefits`, {
				type: QueryTypes.SELECT,
			});

			const idPrefix = counter[0]["COUNT(*)"] + 1;
			const id = `B${idPrefix.toString().padStart(3, "0")}`;

			await database.query(
				`INSERT INTO benefits (id, name, eligible_tier, item_id, buy_qty, get_qty, type, free_item_id) VALUES ('${id}', '${reqBody.name}', '${reqBody.eligible_tier}', '${reqBody.item_id}', ${reqBody.buy_qty}, ${reqBody.get_qty}, 1, '${reqBody.free_item_id}')`,
				{
					type: QueryTypes.INSERT,
				}
			);

			const freeItem = await database.query(
				`SELECT * FROM items WHERE id = '${reqBody.free_item_id}'`,
				{
					type: QueryTypes.SELECT,
				}
			);

			const tier = await database.query(
				`SELECT * FROM tiers WHERE id = '${reqBody.eligible_tier}'`,
				{
					type: QueryTypes.SELECT,
				}
			);

			return res.status(201).send({
				status: 201,
				body: {
					benefit_id: id,
					name: reqBody.name,
					eligible_tier: tier[0].name,
					type: "Promo",
					buy_item: buy_item[0].name,
					buy_qty: reqBody.buy_qty,
					free_item: freeItem[0].name,
					free_qty: reqBody.get_qty,
				},
			});
		}
	} else if (reqBody.disc_perc) {
		const schema = Joi.object({
			disc_perc: Joi.number().min(0).max(100).required(),
		});

		try {
			await schema.validateAsync({
				disc_perc: reqBody.disc_perc,
			});
		} catch (error) {
			return res.status(400).send(error.details[0].message);
		}

		const counter = await database.query(`SELECT COUNT(*) FROM benefits`, {
			type: QueryTypes.SELECT,
		});

		const idPrefix = counter[0]["COUNT(*)"] + 1;
		const id = `B${idPrefix.toString().padStart(3, "0")}`;

		await database.query(
			`INSERT INTO benefits (id, name, eligible_tier, item_id, disc_perc, type) VALUES ('${id}', '${reqBody.name}', '${reqBody.eligible_tier}', '${reqBody.item_id}', ${reqBody.disc_perc}, 2)`,
			{
				type: QueryTypes.INSERT,
			}
		);

		return res.status(201).send({
			status: 201,
			body: {
				benefit_id: id,
				name: reqBody.name,
				eligible_tier: validTier[0].name,
				type: "Percentage Discount",
				buy_item: buy_item[0].name,
				disc_perc: reqBody.disc_perc,
			},
		});
	} else if (reqBody.disc_flat) {
		const schema = Joi.object({
			disc_flat: Joi.number().min(0).required(),
		});

		try {
			await schema.validateAsync({
				disc_flat: reqBody.disc_flat,
			});
		} catch (error) {
			return res.status(400).send(error.details[0].message);
		}

		const counter = await database.query(`SELECT COUNT(*) FROM benefits`, {
			type: QueryTypes.SELECT,
		});

		const idPrefix = counter[0]["COUNT(*)"] + 1;
		const id = `B${idPrefix.toString().padStart(3, "0")}`;

		await database.query(
			`INSERT INTO benefits (id, name, eligible_tier, item_id, disc_flat, type) VALUES ('${id}', '${reqBody.name}', '${reqBody.eligible_tier}', '${reqBody.item_id}', ${reqBody.disc_flat}, 3)`,
			{
				type: QueryTypes.INSERT,
			}
		);

		return res.status(201).send({
			status: 201,
			body: {
				benefit_id: id,
				name: reqBody.name,
				eligible_tier: validTier[0].name,
				type: "Flat Discount",
				buy_item: buy_item[0].name,
				disc_flat: reqBody.disc_flat,
			},
		});
	}
});

router.post("/subcriptions", hasApiToken, isUser, async (req, res) => {
	const { tier_id } = req.body;
	const token = req.header("x-auth-token");

	const tier = await database.query(
		`SELECT * FROM tiers WHERE id = '${tier_id}'`,
		{
			type: QueryTypes.SELECT,
		}
	);

	if (tier.length == 0) {
		return res.status(400).send({
			status: 400,
			message: "Tier does not exist",
		});
	}
	try {
		const decoded = jwt.verify(token, secret);
		const user = await database.query(
			`SELECT * FROM users WHERE id = '${decoded.id}'`,
			{
				type: QueryTypes.SELECT,
			}
		);

		if (user[0].balance < tier[0].price) {
			return res.status(400).send({
				status: 400,
				message: "Insufficient balance",
			});
		}

		await database.query(
			`UPDATE users SET balance = balance - ${tier[0].price} WHERE id = '${decoded.id}'`,
			{
				type: QueryTypes.UPDATE,
			}
		);

		await database.query(
			`INSERT INTO user_tiers (user_id, tier_id, token) VALUES ('${decoded.id}', '${tier_id}', '${tier[0].benefit_token}')`,
			{
				type: QueryTypes.INSERT,
			}
		);

		return res.status(201).send({
			status: 201,
			body: {
				username: user[0].username,
				benefit_token: tier[0].benefit_token,
				current_balance: user[0].balance - tier[0].price,
			},
		});
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Token is not valid",
		});
	}
});

router.get("/benefits", hasApiToken, isUser, async (req, res) => {
	const token = req.header("x-auth-token");

	try {
		const decoded = jwt.verify(token, secret);

		const user_tiers = await database.query(
			`SELECT * FROM user_tiers WHERE user_id = '${decoded.id}'`,
			{
				type: QueryTypes.SELECT,
			}
		);

		const items = await database.query(`SELECT * FROM items`, {
			type: QueryTypes.SELECT,
		});

		const tiers = await database.query("SELECT * FROM tiers", {
			type: QueryTypes.SELECT,
		});

		const benefits = await database.query(`SELECT * FROM benefits`, {
			type: QueryTypes.SELECT,
		});

		const result = [];
		user_tiers.map((user_tier) => {
			const tier_name = tiers.filter((tier) => tier.id == user_tier.tier_id)[0]
				.name;

			const result_benefits = [];
			benefits.map((benefit) => {
				if (benefit.eligible_tier == user_tier.tier_id) {
					let temp_benefit;
					const buy_item_name = items.filter(
						(item) => item.id == benefit.item_id
					)[0].name;

					if (benefit.type == 1) {
						const free_item_name = items.filter(
							(item) => item.id == benefit.free_item_id
						)[0].name;

						temp_benefit = {
							name: benefit.name,
							type: "Promo",
							buy_item: buy_item_name,
							buy_qty: benefit.buy_qty,
							free_item: free_item_name,
							free_qty: benefit.get_qty,
						};
					} else if (benefit.type == 2) {
						temp_benefit = {
							name: benefit.name,
							type: "Percentage Discount",
							buy_item: buy_item_name,
							disc_perc: benefit.disc_perc,
						};
					} else {
						temp_benefit = {
							name: benefit.name,
							type: "Flat Discount",
							buy_item: buy_item_name,
							disc_flat: benefit.disc_flat,
						};
					}
					result_benefits.push(temp_benefit);
				}
			});
			const benefit = {
				tier_name: tier_name,
				benefit_tokens: user_tier.token,
				benefits: result_benefits,
			};

			result.push(benefit);
		});

		return res.status(200).send({
			status: 200,
			body: result,
		});
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Token is not valid",
		});
	}
});

router.post("/transactions", hasApiToken, isUser, async (req, res) => {
	return res.status(200).send({
		status: 200,
		body: {
			message: "Transactions",
		},
	});
});

export default router;

const validItem = async (item_id) => {
	const item = await database.query(
		`SELECT * FROM items WHERE id = '${item_id}'`,
		{
			type: QueryTypes.SELECT,
		}
	);

	return item.length > 0;
};
