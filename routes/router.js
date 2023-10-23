require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../db");

router.get("/api/RIOT/getPlayer", async (req, res) => {
  try {
    const name = req.query.summonerName;
    const reigion = req.query.selectedReigion;
    const url =
      "https://" +
      reigion +
      ".api.riotgames.com/lol/summoner/v4/summoners/by-name/" +
      name +
      "?api_key=" +
      process.env.RIOT_API_KEY;
    const response = await axios.get(url);
    const data = response.data;
    res.json(data);
  } catch (error) {
    console.error("Error making external API request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/RIOT/getRank", async (req, res) => {
  try {
    const id = req.query.summonerId;
    const reigion = req.query.selectedReigion;
    const url =
      "https://" +
      reigion +
      ".api.riotgames.com/lol/league/v4/entries/by-summoner/" +
      id +
      "?api_key=" +
      process.env.RIOT_API_KEY;
    const response = await axios.get(url);
    const data = response.data;
    res.json(data);
  } catch (error) {
    console.error("Error making external API request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/RIOT/inGame", async (req, res) => {
  try {
    const id = req.query.summonerId;
    const reigion = req.query.selectedReigion;
    const url =
      "https://" +
      reigion +
      ".api.riotgames.com/lol/spectator/v4/active-games/by-summoner/" +
      id +
      "?api_key=" +
      process.env.RIOT_API_KEY;
    const response = await axios.get(url);
    const data = response.data;
    res.json(data);
  } catch (error) {
    // console.error("Error making external API request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/RIOT/getMatches", async (req, res) => {
  try {
    const puuid = req.query.summonerPuuid;
    const genReigion = req.query.selectedReigion;
    const url =
      "https://" +
      genReigion +
      ".api.riotgames.com/lol/match/v5/matches/by-puuid/" +
      puuid +
      "/ids?queue=420&start=0&count=1" +
      "&api_key=" +
      process.env.RIOT_API_KEY;
    const response = await axios.get(url);
    const data = response.data;
    res.json(data);
  } catch (error) {
    console.error("Error making external API request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/RIOT/getMatchInfo", async (req, res) => {
  try {
    const match = req.query.matchId;
    const genReigion = req.query.selectedReigion;
    const url =
      "https://" +
      genReigion +
      ".api.riotgames.com/lol/match/v5/matches/" +
      match +
      "?api_key=" +
      process.env.RIOT_API_KEY;
    const response = await axios.get(url);
    const data = response.data;
    res.json(data);
  } catch (error) {
    console.error("Error making external API request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const poll = async () => {
  try {
    console.log("Polling");
    const dbresponse = await pool.query("SELECT * FROM info");
    const summoners = dbresponse.rows;
    // console.log(summoners);
    for (let i = 0; i < summoners.length; i++) {
      let genReigion = "americas";
      if (summoners[i].reigion === "kr") {
        genReigion = "asia";
      } else if (summoners[i].reigion === "euw1") {
        genReigion = "europe";
      }
      // check for new game
      const url =
        "https://" +
        genReigion +
        ".api.riotgames.com/lol/match/v5/matches/by-puuid/" +
        summoners[i].puuid +
        "/ids?queue=420&start=0&count=1" +
        "&api_key=" +
        process.env.RIOT_API_KEY;

      const response = await axios.get(url);
      const data = response.data;
      // console.log(data)

      // if new game, then get match info
      if (summoners[i].recent !== data[0]) {
        console.log(`${summoners[i].description} played a new game!`);
        const url =
          "https://" +
          genReigion +
          ".api.riotgames.com/lol/match/v5/matches/" +
          data[0] +
          "?api_key=" +
          process.env.RIOT_API_KEY;

        const response = await axios.get(url);
        const matchdata = response.data.info.participants;
        const gameStart = response.data.info.gameStartTimestamp;
        let win = false;
        let time = 0;

        for (let j = 0; j < matchdata.length; j++) {
          if (matchdata[j].summonerName === summoners[i].description) {
            win = matchdata[j].win;
            time = matchdata[j].timePlayed;
          }
        }

        const rankurl =
          "https://" +
          summoners[i].reigion +
          ".api.riotgames.com/lol/league/v4/entries/by-summoner/" +
          summoners[i].id +
          "?api_key=" +
          process.env.RIOT_API_KEY;

        const rankresponse = await axios.get(rankurl);
        const rankdata = rankresponse.data;

        let fullrank = "";
        let tier = ""
        let lp = 0;
        let rank = ""

        for (let k = 0; k < rankdata.length; k++) {
          if (rankdata[k].queueType === "RANKED_SOLO_5x5") {
            tier = rankdata[k].tier
            rank = rankdata[k].rank;
            lp = rankdata[k].leaguePoints;
            fullrank = tier + " " + rank
          }
        }
        
        const oldRank = summoners[i].rank
        const oldTier = summoners[i].tier

        let lpChange = 0

        if(tier == oldTier && rank == oldRank) {
          lpChange = lp - summoners[i].lp
        }

        const summonerName = summoners[i].description;

        const newMatch = await pool.query(
          "INSERT INTO matches (winloss, rank, summoner, lp, gamestart, length, lpchange) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *",
          [win, fullrank, summonerName, lp, gameStart, time, lpChange]
        );

        // need to change summoners recent to new match and update rank
        await pool.query("UPDATE info SET recent = $1 WHERE description = $2", [
          data[0],
          summoners[i].description,
        ]);
        await pool.query("UPDATE info SET rank = $1 WHERE description = $2", [
          rank,
          summoners[i].description,
        ]);
        await pool.query("UPDATE info SET lp = $1 WHERE description = $2", [
          lp,
          summoners[i].description,
        ]);
        await pool.query("UPDATE info SET tier = $1 WHERE description = $2", [
          tier,
          summoners[i].description,
        ]);

        console.log(newMatch.rows[0]);
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

poll();

setInterval(poll, 60000);

module.exports = router;
