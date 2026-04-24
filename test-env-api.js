import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://localhost:3000/api/env');
  console.log(await res.json());
}
test();
