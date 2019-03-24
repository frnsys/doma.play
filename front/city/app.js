import api from '../api';

api.get('/state', (state) => {
  console.log(state);
});
