import type { NextApiRequest, NextApiResponse } from 'next';
import { xmtpService } from '../../src/xmtpService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      await xmtpService.start();
      res.status(200).json({ message: 'XMTP service started successfully' });
    } catch (error) {
      console.error('Error starting XMTP service:', error);
      res.status(500).json({ error: 'Failed to start XMTP service' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 