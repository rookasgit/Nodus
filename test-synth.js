import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { roleId: 'Agent1', text: 'Hello' },
        { roleId: 'Agent2', text: 'World' }
      ]
    })
  });
  console.log(res.status);
  console.log(await res.text());
}

test();
