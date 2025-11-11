import pandas as pd
import json

def excel_a_json(ruta_excel, hoja=None, salida_json=None):
    """
    Convierte un archivo Excel a JSON.
    - ruta_excel: Ruta del archivo .xlsx o .xls
    - hoja: Nombre o número de la hoja (opcional)
    - salida_json: Nombre del archivo de salida (opcional)
    """

    # Leer archivo Excel
    if hoja:
        df = pd.read_excel(ruta_excel, sheet_name=hoja)
    else:
        df = pd.read_excel(ruta_excel)

    # Convertir a lista de diccionarios
    data = df.to_dict(orient="records")

    # Si no se especifica salida, genera una con el mismo nombre
    if not salida_json:
        salida_json = ruta_excel.rsplit(".", 1)[0] + ".json"

    # Guardar en archivo JSON
    with open(salida_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Archivo convertido correctamente: {salida_json}")

# === Ejemplo de uso ===
# excel_a_json("Ch_2_Annex2B_COL_s.xlsx", hoja="Table 1")
