"""Prepara el dataset de EcoMaps a partir de TrashNet.

Deja 4 clases (solo lo que EcoMaps recibe en el mapa):
  plastico, vidrio, papel_carton, metal
con 300 imágenes de entrenamiento y 60 de prueba por clase.
Las de prueba NO se suben a Teachable Machine (sirven para evaluar, RF-08).

Uso (desde la carpeta ml/):
  # Opción A: carpeta de TrashNet ya descargada (subcarpetas cardboard, glass, metal, paper, plastic, trash)
  python preparar_dataset.py --origen RUTA/dataset-resized

  # Opción B: bajarlo de Hugging Face (pip install datasets pillow)
  python preparar_dataset.py --hf
"""
import argparse
import random
from pathlib import Path

from PIL import Image

# Clase de TrashNet -> clase de EcoMaps. 'trash' se descarta a propósito.
MAPA = {"plastic": "plastico", "glass": "vidrio", "metal": "metal",
        "paper": "papel_carton", "cardboard": "papel_carton"}
N_ENTRENAMIENTO, N_PRUEBA = 300, 60
LADO_MAX = 512  # imágenes livianas: más rápido de subir y de entrenar
EXT = {".jpg", ".jpeg", ".png", ".webp"}


def reunir_desde_carpeta(origen: Path) -> dict:
    """Devuelve {clase_ecomaps: [imagen o ruta, ...]} leyendo subcarpetas."""
    grupos = {c: [] for c in set(MAPA.values())}
    for sub in origen.iterdir():
        clase = MAPA.get(sub.name.lower())
        if clase and sub.is_dir():
            grupos[clase] += [p for p in sub.iterdir() if p.suffix.lower() in EXT]
    return grupos


def reunir_desde_hf() -> dict:
    from datasets import load_dataset  # import tardío: solo si se usa --hf
    ds = load_dataset("garythung/trashnet", split="train")
    nombres = ds.features["label"].names
    grupos = {c: [] for c in set(MAPA.values())}
    for fila in ds:
        clase = MAPA.get(nombres[fila["label"]].lower())
        if clase:
            grupos[clase].append(fila["image"])  # objetos PIL
    return grupos


def guardar(img, destino: Path):
    if not isinstance(img, Image.Image):
        img = Image.open(img)
    img = img.convert("RGB")
    img.thumbnail((LADO_MAX, LADO_MAX))
    img.save(destino, "JPEG", quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origen", type=Path, help="carpeta de TrashNet")
    ap.add_argument("--hf", action="store_true", help="descargar de Hugging Face")
    ap.add_argument("--salida", type=Path, default=Path("dataset"))
    a = ap.parse_args()
    if not a.origen and not a.hf:
        ap.error("indica --origen RUTA o --hf")

    grupos = reunir_desde_hf() if a.hf else reunir_desde_carpeta(a.origen)
    random.seed(42)  # mismo reparto cada vez que se corre
    for clase, imgs in sorted(grupos.items()):
        if len(imgs) < N_ENTRENAMIENTO + N_PRUEBA:
            print(f"AVISO {clase}: solo {len(imgs)} imágenes, se reparte 80/20")
        random.shuffle(imgs)
        n_prueba = min(N_PRUEBA, len(imgs) // 5)
        n_entr = min(N_ENTRENAMIENTO, len(imgs) - n_prueba)
        reparto = {"prueba": imgs[:n_prueba], "entrenamiento": imgs[n_prueba:n_prueba + n_entr]}
        for parte, lista in reparto.items():
            carpeta = a.salida / parte / clase
            carpeta.mkdir(parents=True, exist_ok=True)
            for i, img in enumerate(lista):
                guardar(img, carpeta / f"{clase}_{i:03d}.jpg")
        print(f"{clase}: {n_entr} entrenamiento + {n_prueba} prueba")
    print(f"\nListo. Sube a Teachable Machine las carpetas de {a.salida}/entrenamiento/")


if __name__ == "__main__":
    main()
