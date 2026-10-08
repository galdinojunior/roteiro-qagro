"""Extrai a aba 'roteiros' do Planejador.xlsx para testes/fixtures/privado/roteiros_real.json.

Uso:  python ferramentas/extrair_fixture_real.py <caminho_do_planejador>
   ou defina PLANEJADOR_XLSX

O arquivo gerado contém coordenadas de domicílios e fica FORA do Git (.gitignore).
O Planejador costuma estar aberto/sincronizando; por isso o script trabalha numa cópia.
"""
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

import openpyxl

DESTINO = pathlib.Path(__file__).resolve().parent.parent / "testes" / "fixtures" / "privado" / "roteiros_real.json"


def copiar(origem: pathlib.Path, destino: pathlib.Path) -> None:
    try:
        shutil.copyfile(origem, destino)
    except PermissionError:
        # Arquivo bloqueado pelo Excel/OneDrive: o Copy-Item do PowerShell consegue ler.
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", f'Copy-Item -LiteralPath "{origem}" -Destination "{destino}" -Force'],
            check=True,
        )


def valor(v):
    if isinstance(v, datetime.datetime):
        return {"$data": v.date().isoformat()}
    if isinstance(v, datetime.date):
        return {"$data": v.isoformat()}
    return v


def main() -> None:
    origem_texto = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PLANEJADOR_XLSX")
    if not origem_texto:
        print("Uso: python ferramentas/extrair_fixture_real.py <caminho do Planejador.xlsx> ou defina PLANEJADOR_XLSX")
        raise SystemExit(2)
    origem = pathlib.Path(origem_texto)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        copia = pathlib.Path(tmp) / "Planejador.xlsx"
        copiar(origem, copia)
        wb = openpyxl.load_workbook(copia, read_only=True, data_only=True)
        linhas = [[valor(v) for v in linha] for linha in wb["roteiros"].iter_rows(values_only=True)]
        wb.close()
    DESTINO.write_text(json.dumps(linhas, ensure_ascii=False), encoding="utf-8")
    print(f"{len(linhas)} linhas -> {DESTINO}")


if __name__ == "__main__":
    main()
