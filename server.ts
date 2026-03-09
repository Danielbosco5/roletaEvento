import express from 'express';
import { createServer as createViteServer } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Load pre-registered participants
type Participante = { cpf: string; cor: string };
let participantes: Participante[] = [];
try {
  const data = readFileSync(join(__dirname, 'participantes.json'), 'utf-8');
  participantes = JSON.parse(data);
  console.log(`${participantes.length} participantes carregados do JSON.`);
} catch (e) {
  console.error('Erro ao carregar participantes.json:', e);
}

const COLORS = ['azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'branco'];

app.post('/api/checkin', (req, res) => {
  const { cpf } = req.body;

  if (!cpf || typeof cpf !== 'string') {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  // Sanitize CPF (remove non-digits)
  const cleanCpf = cpf.replace(/\D/g, '');

  if (cleanCpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
  }

  // Look up in pre-registered participants
  const participante = participantes.find(p => p.cpf.replace(/\D/g, '') === cleanCpf);

  if (!participante) {
    return res.status(404).json({ error: 'CPF não cadastrado no evento.' });
  }

  // Validate the assigned color
  const assignedColor = participante.cor.toLowerCase();
  if (!COLORS.includes(assignedColor)) {
    return res.status(500).json({ error: 'Cor inválida no cadastro.' });
  }

  return res.json({ cpf: cleanCpf, color: assignedColor });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
