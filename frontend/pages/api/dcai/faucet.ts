import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  try {
    if (action === 'status') {
      const response = await fetch('http://139.180.140.143/faucet/');
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (action === 'request') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const { address } = req.body;
      const response = await fetch('http://139.180.140.143/faucet/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    if (action === 'block') {
      const response = await fetch('http://139.180.140.143/rpc/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }),
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('Faucet API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
