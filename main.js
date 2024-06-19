
const clientId = "ef0ce806f4b74ae9808df4c5d53cecda";
var spotify_token = null;
var rate_limited = false
var redirectUri = "https://g3rrit.github.io/spotify-playlist-analyzer/";
//const redirectUri = "http://localhost:8888/";


function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

function sha256(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data)
}

function base64urlencode(a) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function authenticate() {
  const scope = "user-read-private";

  const authUrl = new URL("https://accounts.spotify.com/authorize")

  const codeVerifier  = generateRandomString(64);
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64urlencode(hashed);

  // generated in the previous step
  window.localStorage.setItem("code_verifier", codeVerifier);

  const params =  {
    response_type: "code",
    client_id: clientId,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  }

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}

function errorPopup(msg) {
  var popup = document.getElementById("popup");
  popup.textContent = msg;
  popup.style.display = 'block';

  setTimeout(function () {
    popup.style.display = 'none';
  }, 3000);
}

function process_song(name, link) {
  fetch(link, {
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + spotify_token,
    }
  }).then(response => response.json())
    .then(data => {
      if (data.error) {
        console.log("Error while retriving song data");
        rate_limited = true;
        return;
      }
      populateTable({
        name: name,
        duration: Math.round(data.duration_ms / 1000),
        tempo: Math.round(data.tempo),
        danceability: data.danceability,
      });
    })
    .catch(error => {
      rate_limited = true
      console.error('Error while retriving playlist:', error)
    });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function process_playlist(link, wait_r=false) {
  fetch(link, {
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + spotify_token,
    }
  }).then(response => response.json())
    .then(async data => {
      if (data.total > 40) {
        wait_r = true
      }
      for (const item of data.items) {
        if (rate_limited) {
          errorPopup("Rate limited, please wait a minute or two...");
          return;
        }

        if (wait_r) {
          await sleep(500);
        }
        process_song(item.track.name, 'https://api.spotify.com/v1/audio-features/' + item.track.id);
      }
      if (data.next != null) {
        process_playlist(data.next, wait_r);
      }
    })
    .catch(error => {
      rate_limited = true;
      console.error('Error while retriving playlist:', error)
    });
}

function check_playlist() {
  var playlist_id = document.getElementById("textInput").value;
  if (playlist_id.startsWith('http')) {
    var url = new URL(playlist_id);
    playlist_id = url.pathname.split('/')[2];
  }

  if (spotify_token == null) {
    errorPopup("Not authenticated");
    return;
  }

  const tableBody = document.querySelector('#data-table tbody');
  tableBody.innerHTML = '';
  process_playlist('https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks');
}

function init() {
  var topButton = document.getElementById('topButton');
  var checkButton = document.getElementById('checkButton');

  const urlParams = new URLSearchParams(window.location.search);
  let code = urlParams.get('code');

  if (code == null) {
    localStorage.clear(); // not needed but cleaning up is always nice
    topButton.disabled = false;
    checkButton.disabled = true;
    topButton.style.display = 'block';
  } else {
    topButton.disabled = true;
    topButton.style.display = 'none';
    // enable chek button after we get the actual token

    let codeVerifier = localStorage.getItem('code_verifier');

    if (codeVerifier == null) {
      errorPopup("ERROR - Please reload");
    }

    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    }

    fetch("https://accounts.spotify.com/api/token", payload).then(response => response.json()).then(data => {
      spotify_token = data.access_token;
      checkButton.disabled = false;
    }).catch(error => {
      console.error('Error while retriving token:', error)
    });
  }

  setInterval(function() {
    if (rate_limited) {
      setTimeout(function() {
        rate_limited = false;
      }, 60000);
    }
  }, 60000)
}

function populateTable(item) {
  const tableBody = document.querySelector('#data-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `<td>${item.name}</td><td>${item.duration}</td><td>${item.tempo}</td><td>${item.danceability}</td>`;
  tableBody.appendChild(row);
}

function sort_table(n) {
  const table = document.getElementById("data-table");
  let rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
  switching = true;
  dir = "asc";

  while (switching) {
    switching = false;
    rows = table.rows;

    for (i = 1; i < (rows.length - 1); i++) {
      shouldSwitch = false;
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];

      if (dir === "asc") {
        if (Number(x.innerHTML.toLowerCase()) > Number(y.innerHTML.toLowerCase())) {
          shouldSwitch = true;
          break;
        }
      } else if (dir === "desc") {
        if (Number(x.innerHTML.toLowerCase()) < Number(y.innerHTML.toLowerCase())) {
          shouldSwitch = true;
          break;
        }
      }
    }

    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else {
      if (switchcount === 0 && dir === "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

window.onload = init;
