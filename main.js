
spotify_token = null;

function getRandomBase64String(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  const base64String = btoa(String.fromCharCode.apply(null, array));
  return base64String.substring(0, length);
}

function get_hash_params() {
  var hash = window.location.hash.substring(1);
  if (hash == null || hash == '') {
    return {}
  }

  return hash.split('&').reduce(function (res, item) {
    var parts = item.split('=');
    res[parts[0]] = parts[1];
    return res;
  }, {});
}

const stateKey = 'spotify_auth_state';

function authenticate() {
  var client_id = 'd1aa8bf4846d46e985716baba01bf0ca';
  var redirect_uri = 'https://g3rrit.github.io/spotify-playlist-analyzer/';
  //var redirect_uri = 'http://localhost:8888/';

  var scope = 'user-read-private';

  var url = 'https://accounts.spotify.com/authorize';
  url += '?response_type=token';
  url += '&client_id=' + encodeURIComponent(client_id);
  url += '&scope=' + encodeURIComponent(scope);
  url += '&redirect_uri=' + encodeURIComponent(redirect_uri);

  window.location.href = url
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
      populateTable({
        name: name,
        duration: Math.round(data.duration_ms / 1000),
        tempo: data.tempo,
        danceability: data.danceability,
      }
      );
    })
    .catch(error => console.error('Error while retriving playlist:', error));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function process_playlist(link, wait=false) {
  fetch(link, {
    method: 'GET',
    headers: {
      "Authorization": "Bearer " + spotify_token,
    }
  }).then(response => response.json())
    .then(async data => {
      if (data.length > 60) {
        wait = true
      }
      for (const item of data.items) {
        if (wait = true) {
          await sleep(400);
        }
        process_song(item.track.name, 'https://api.spotify.com/v1/audio-features/' + item.track.id);
      }
      if (data.next != null) {
        process_playlist(data.next, wait);
      }
    })
    .catch(error => console.error('Error while retriving playlist:', error));
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
  hash_params = get_hash_params();

  authenticated = false;

  var topButton = document.getElementById('topButton');
  var checkButton = document.getElementById('checkButton');

  if ("access_token" in hash_params) {
    authenticated = true;
    spotify_token = hash_params["access_token"];
  } else {
    authenticated = false;
    spotify_token = null;
  }

  if (authenticated) {
    topButton.disabled = true;
    topButton.style.display = 'none';
    checkButton.disabled = false;
  } else {
    topButton.disabled = false;
    checkButton.disabled = true;
    topButton.style.display = 'block';
  }
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
        if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
          shouldSwitch = true;
          break;
        }
      } else if (dir === "desc") {
        if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
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
