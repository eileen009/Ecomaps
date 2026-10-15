-- EcoMaps - esquema (MySQL 8). Generado con scripts/exportar_bd.py
CREATE DATABASE IF NOT EXISTS `ecomapsbd` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ecomapsbd`;

CREATE TABLE IF NOT EXISTS `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel` int NOT NULL DEFAULT '1',
  `puntos_totales` int NOT NULL DEFAULT '0',
  `foto_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verificada` tinyint(1) NOT NULL DEFAULT '0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `rol` enum('ciudadano','empresa','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ciudadano',
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `solicitud_empresa` tinyint(1) NOT NULL DEFAULT '0',
  `marco_elegido` smallint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuario_correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categoria_residuo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icono` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion_corta` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categoria_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `punto_reciclaje` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ciudad` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitud` decimal(10,7) NOT NULL,
  `longitud` decimal(10,7) NOT NULL,
  `horario` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_contacto` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_contacto` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('pendiente','activo','rechazado','reportado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `creado_por` int DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_punto_usuario` (`creado_por`),
  KEY `idx_punto_estado` (`estado`),
  KEY `idx_punto_ciudad` (`ciudad`),
  KEY `idx_punto_ubicacion` (`latitud`,`longitud`),
  CONSTRAINT `fk_punto_usuario` FOREIGN KEY (`creado_por`) REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `punto_material` (
  `id_punto` int NOT NULL,
  `id_categoria` int NOT NULL,
  PRIMARY KEY (`id_punto`,`id_categoria`),
  KEY `fk_pm_categoria` (`id_categoria`),
  CONSTRAINT `fk_pm_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categoria_residuo` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pm_punto` FOREIGN KEY (`id_punto`) REFERENCES `punto_reciclaje` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accion_reciclaje` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `id_categoria` int NOT NULL,
  `id_punto` int DEFAULT NULL,
  `cantidad` decimal(8,2) NOT NULL,
  `unidad` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'kg',
  `foto_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` enum('pendiente','confirmada','rechazada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `puntos_otorgados` int NOT NULL DEFAULT '0',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `motivo_rechazo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cantidad_recibida` decimal(8,2) DEFAULT NULL,
  `foto_recibo_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_revision` datetime DEFAULT NULL,
  `id_revisor` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_accion_categoria` (`id_categoria`),
  KEY `fk_accion_punto` (`id_punto`),
  KEY `idx_accion_estado` (`estado`),
  KEY `idx_accion_usuario` (`id_usuario`),
  KEY `fk_accion_revisor` (`id_revisor`),
  CONSTRAINT `fk_accion_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categoria_residuo` (`id`),
  CONSTRAINT `fk_accion_punto` FOREIGN KEY (`id_punto`) REFERENCES `punto_reciclaje` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_accion_revisor` FOREIGN KEY (`id_revisor`) REFERENCES `usuario` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_accion_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reporte` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_punto` int NOT NULL,
  `id_usuario` int DEFAULT NULL,
  `tipo` enum('cerrado','no_existe','direccion_incorrecta','horario_cambio','material_no_recibido','otro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comentario` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('pendiente','revisado','resuelto') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reporte_punto` (`id_punto`),
  KEY `idx_reporte_estado` (`estado`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `reporte_ibfk_1` FOREIGN KEY (`id_punto`) REFERENCES `punto_reciclaje` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reporte_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
