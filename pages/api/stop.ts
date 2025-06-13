import type { NextApiRequest, NextApiResponse } from 'next';
import { xmtpService } from '../../src/xmtpService';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      xmtpService.stop();
      res.status(200).json({ message: 'XMTP service stopped successfully' });
    } catch (error) {
      console.error('Error stopping XMTP service:', error);
      res.status(500).json({ error: 'Failed to stop XMTP service' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 