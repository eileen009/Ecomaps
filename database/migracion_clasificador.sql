-- EcoMaps · Migración del clasificador de residuos (RF-01, RF-05, RF-06, RF-07)
-- Para una base de datos que YA existe (por ejemplo la de Aiven). Ejecútala UNA sola vez:
-- MySQL no permite «ADD COLUMN IF NOT EXISTS», así que repetirla da error de columna duplicada.
-- Haz una copia de seguridad antes.

ALTER TABLE categoria_residuo
  ADD COLUMN clase_modelo VARCHAR(30) NULL COMMENT 'nombre de la clase en metadata.json (varias categorías pueden compartirla)',
  ADD COLUMN caneca ENUM('blanca','negra','verde') NOT NULL DEFAULT 'blanca',
  ADD KEY idx_categoria_clase_modelo (clase_modelo);

ALTER TABLE accion_reciclaje
  ADD COLUMN categoria_detectada_id INT NULL,
  ADD COLUMN confianza_deteccion DECIMAL(5,4) NULL,
  ADD COLUMN requiere_revision TINYINT(1) NOT NULL DEFAULT 0,
  ADD KEY fk_accion_detectada (categoria_detectada_id),
  ADD CONSTRAINT fk_accion_detectada FOREIGN KEY (categoria_detectada_id) REFERENCES categoria_residuo (id);

CREATE TABLE IF NOT EXISTS clasificaciones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  usuario_id INT NULL,
  clase_predicha VARCHAR(30) NOT NULL,
  confianza DECIMAL(5,4) NOT NULL,
  clase_confirmada VARCHAR(30) NULL COMMENT 'lo que eligió o corrigió el usuario',
  texto_otro VARCHAR(120) NULL COMMENT '«Ninguna de estas»: lo que escribió el usuario',
  categoria_predicha_id INT NULL,
  categoria_confirmada_id INT NULL,
  imagen_url VARCHAR(300) NULL COMMENT 'solo si el usuario acepta compartirla para reentrenar',
  version_modelo VARCHAR(20) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clasif_usuario (usuario_id),
  CONSTRAINT chk_clasif_confianza CHECK (confianza BETWEEN 0 AND 1),
  CONSTRAINT fk_clasif_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE SET NULL,
  CONSTRAINT fk_clasif_cat_pred FOREIGN KEY (categoria_predicha_id) REFERENCES categoria_residuo (id) ON DELETE SET NULL,
  CONSTRAINT fk_clasif_cat_conf FOREIGN KEY (categoria_confirmada_id) REFERENCES categoria_residuo (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clase del modelo y caneca de cada categoría (Resolución 2184 de 2019).
-- Papel y Cartón comparten la clase «papel_carton».
UPDATE categoria_residuo SET clase_modelo = 'plastico',     caneca = 'blanca' WHERE nombre = 'Plástico';
UPDATE categoria_residuo SET clase_modelo = 'vidrio',       caneca = 'blanca' WHERE nombre = 'Vidrio';
UPDATE categoria_residuo SET clase_modelo = 'papel_carton', caneca = 'blanca' WHERE nombre IN ('Papel', 'Cartón');
UPDATE categoria_residuo SET clase_modelo = 'metal',        caneca = 'blanca' WHERE nombre = 'Metal';
UPDATE categoria_residuo SET clase_modelo = 'organico',     caneca = 'verde'  WHERE nombre = 'Orgánico';
-- «no_aprovechable» (caneca negra) no es una categoría del catálogo: ningún punto la recibe.
