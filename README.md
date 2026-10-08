# App de Roteiros QAgro — COPPETEC

Aplicativo web instalável (PWA) para as duplas de campo da pesquisa QAgro consultarem o roteiro do dia **sem internet**, marcarem o status de cada ponto com **GPS automático** e sincronizarem tudo com uma **planilha Google** quando houver sinal.

- **Coordenador:** cola a aba `roteiros` do `Planejador.xlsx` na planilha Google; gerencia usuários e configuração na própria planilha.
- **Entrevistador:** instala o app pelo link do WhatsApp, entra com seu código, vê só a própria dupla.
- **Supervisor:** vê e acompanha todas as duplas.

## No ar

- **Endereço do app:** <https://galdinojunior.github.io/roteiro-qagro/> (publicado em 08/10/2026, versão 1.0.0)
- **Servidor:** Google Apps Script vinculado à planilha de roteiros; o endereço fica em `app/config.js`.
- **Publicação:** a cada `git push` na `main`, o GitHub Actions roda os testes e publica a pasta `app/`.

## Documentação

| Documento | Para quem |
|---|---|
| [docs/guia-entrevistador.md](docs/guia-entrevistador.md) | Entrevistadores (enviar no WhatsApp) |
| [docs/operacao-diaria.md](docs/operacao-diaria.md) | Coordenador: roteiro, usuários, acompanhamento |
| [docs/implantacao.md](docs/implantacao.md) | Implantação inicial (planilha, Apps Script, GitHub Pages) |
| [docs/2026-09-26-roteiro-qagro-design.md](docs/2026-09-26-roteiro-qagro-design.md) | Especificação |
| [docs/decisoes.md](docs/decisoes.md) | Registro de decisões |
| [docs/2026-09-26-plano-implementacao.md](docs/2026-09-26-plano-implementacao.md) | Plano de implementação |

## Desenvolvimento

Requer Node 22+. Sem dependências.

```bash
npm test            # testes automatizados
npm run servidor    # app + API simulada em http://localhost:8080
```

Códigos do servidor local: `ENTR01` (dupla A1), `ENTR02` (A2), `SUPE01` (supervisor), `INAT01` (inativo).

Teste opcional com dados reais (ficam fora do Git): `python ferramentas/extrair_fixture_real.py "<caminho do Planejador.xlsx>" && npm test` (ou defina `PLANEJADOR_XLSX`).
