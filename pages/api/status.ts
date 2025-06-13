import type { NextApiRequest, NextApiResponse } from 'next';
import { xmtpService } from '../../src/xmtpService';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const status = xmtpService.getStatus();
      res.status(200).json(status);
    } catch (error) {
      console.error('Error fetching service status:', error);
      res.status(500).json({ error: 'Failed to fetch service status' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 