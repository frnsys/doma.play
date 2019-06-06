function get(endpoint, onSuccess, onErr) {
  let url = `${endpoint}`;
  fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    method: 'GET',
  })
    .then(res => res.json())
    .then((data) => onSuccess && onSuccess(data))
    .catch(err => { console.log(err) });
}

function post(endpoint, data, onSuccess, onErr) {
  let url = `${endpoint}`;
  fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    method: 'POST',
    body: JSON.stringify(data)
  })
    .then(res => res.json())
    .then((data) => onSuccess && onSuccess(data))
    .catch(err => { throw err });
}

export default {get, post};

