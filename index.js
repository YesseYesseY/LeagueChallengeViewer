const fs = require("fs");
const Express = require("express");
const path = require("path");
let challenges = {};
let categories = {};
let champs = {};
let champIdsOrderedByName = [];

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let LCULOCKFILE = {};
let LCUPASSWORD = "";

async function LCUGetJson(path)
{
    const test = await fetch(`${LCULOCKFILE.protocol}://127.0.0.1:${LCULOCKFILE.port}${path}`, {
        headers: {
            Authorization: LCUPASSWORD
        }
    });
    return await test.json();
}

async function Main()
{
    if (!fs.existsSync("C:/Riot Games/League of Legends/LeagueClient.exe"))
    {
        console.log("League doesnt exists!");
        return;
    }

    if (!fs.existsSync("C:/Riot Games/League of Legends/lockfile"))
    {
        console.log("The league client is not open, please open it :)")
        return;
    }

    const lockfiledata = fs.readFileSync("C:/Riot Games/League of Legends/lockfile").toString().split(":");
    const lockfile = {
        processName: lockfiledata[0],
        processId: lockfiledata[1],
        port: lockfiledata[2],
        password: lockfiledata[3],
        protocol: lockfiledata[4]
    };
    LCULOCKFILE = lockfile;

    LCUPASSWORD = "Basic " + btoa(`riot:${lockfile.password}`);

    challenges = await LCUGetJson("/lol-challenges/v1/challenges/local-player");
    
    Object.values(challenges).forEach(e => {
        if (!(e.category in categories))
            categories[e.category] = [];
        
        categories[e.category].push(e.id);
    });

    (await LCUGetJson("/lol-game-data/assets/v1/champion-summary.json")).forEach(e => champs[e.id] = e.name);
    champIdsOrderedByName = Object.entries(champs).sort(([_b, a], [_a, b]) => a.localeCompare(b)).map(([id]) => Number(id));

    StartExpress();
}

const RankOrder = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
function RankSort(a, b) {
    if (Array.isArray(a))
    {
        a = a[0];
        b = b[0];
    }
    
    const ai = RankOrder.indexOf(a);
    const bi = RankOrder.indexOf(b);
    
    return ai - bi;
}

function StartExpress()
{
    const app = Express();
    
    app.get("/challenges", async (req, res) => res.json(await LCUGetJson("/lol-challenges/v1/challenges/local-player")));
    app.get("/champs", async (req, res) => res.json(await LCUGetJson("/lol-game-data/assets/v1/champion-summary.json")));
    app.get("/", async (req, res) => res.sendFile(path.resolve("./template.html")));
    app.get("/legacy", (req, res) => {
        tosend = "<!DOCTYPE html><html><head><title>League Challenge Viewer</title></head><body>";
        Object.entries(categories).forEach(([key, val]) => {
            tosend += `<fieldset><legend>${key}</legend>`;
            val.forEach(e => {
                const challenge = challenges[e];
                tosend += `<h1>${challenge.name}</h1><p>${challenge.description}</p><h2>Rewards: (Current points: ${challenge.currentValue})</h2><ul>`;
                Object.entries(challenge.thresholds).sort(RankSort).forEach(([rankname, thresholddata]) => {
                    tosend += `<li>${rankname} (${thresholddata.value} points required)</li><ul>`;
                    thresholddata.rewards.forEach(reward => {
                        rewardname = reward.category;
                        if (reward.name !== "")
                            rewardname += ` (${reward.name})`;
                        tosend += `<li>${reward.quantity}x ${rewardname}`;
                    });
                    tosend += "</ul>";
                });
                tosend += "</ul>";
                if (challenge.idListType === "CHAMPION")
                {
                    let toadd = '<h2>Progress: (/*REPLACETHIS*/)</h2><div style="display: grid; grid-template-columns: repeat(10, auto); gap: 10px;">';
                    let totalchampions = 0;
                    let totalcompleted = 0;
                    champIdsOrderedByName.forEach(champId => {
                        if (challenge.availableIds.includes(champId) || challenge.availableIds.length === 0)
                        {
                            const completed = challenge.completedIds.includes(champId);
                            toadd += `<label style="user-select: none"><input type="checkbox" ${completed ? "checked" : ""} onclick="return false">${champs[champId]}</label>`;
                            totalchampions += 1;
                            if (completed) totalcompleted += 1;
                        }
                    });
                    toadd += "</div>"
                    tosend += toadd.replace("/*REPLACETHIS*/", `${totalcompleted}/${totalchampions}`);
                }
            });
            
            tosend += "</fieldset>";
        });
        tosend += "</body></html>";
        res.send(tosend);
    });

    app.listen(43210);
}

Main();