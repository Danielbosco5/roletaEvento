import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

type Participante = { cpf: string; cor: string };

const COLORS = ['azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'branco'];

let participantes: Participante[] = [];
try {
  const data = readFileSync(join(process.cwd(), 'participantes.json'), 'utf-8');
  participantes = JSON.parse(data);
} catch {
  // fallback: try relative path
  try {
    const data = readFileSync(join(__dirname, '..', 'participantes.json'), 'utf-8');
    participantes = JSON.parse(data);
  } catch {
    participantes = [];
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cpf } = req.body;

  if (!cpf || typeof cpf !== 'string') {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  const cleanCpf = cpf.replace(/\D/g, '');

  if (cleanCpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
  }

  const participante = participantes.find(p => p.cpf.replace(/\D/g, '') === cleanCpf);

  if (!participante) {
    return res.status(404).json({ error: 'CPF não cadastrado no evento.' });
  }

  const assignedColor = participante.cor.toLowerCase();
  if (!COLORS.includes(assignedColor)) {
    return res.status(500).json({ error: 'Cor inválida no cadastro.' });
  }

  return res.json({ cpf: cleanCpf, color: assignedColor });
}
