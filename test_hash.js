const bcrypt = require('bcryptjs');

const hash = '$2a$10$71xfcEFfaGvGZea03GFoXeTH485vDPc0hVpGQqmzx9mr4xIU7n8Dy';
const pass = 'Martin@21';

async function test() {
  const match = await bcrypt.compare(pass, hash);
  console.log("Match?", match);
}

test();
