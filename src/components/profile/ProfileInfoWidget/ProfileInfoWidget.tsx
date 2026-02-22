"use client";

import React, { useState } from 'react';
import type { ProfileInfoWidgetProps } from './ProfileInfoWidget.types';
import styles from './ProfileInfoWidget.module.css';

export function ProfileInfoWidget({
  userName,
  email,
  onSaveUserName,
}: ProfileInfoWidgetProps): React.ReactElement {
  const [name, setName] = useState(userName);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    onSaveUserName(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGradient} />
      <div className={styles.glowPurple} />
      <div className={styles.borderLayer} />

      <div className={styles.content}>
        {/* Avatar + título */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            {(name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className={styles.headerTexts}>
            <h2 className={styles.headerTitle}>Información personal</h2>
            <p className={styles.headerSub}>Gestiona tus datos de perfil</p>
          </div>
        </div>

        {/* Toast éxito */}
        {saved && (
          <div className={styles.toast}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Cambios guardados correctamente
          </div>
        )}

        <div className={styles.fields}>
          {/* Nombre */}
          <div>
            <label className={styles.fieldLabel}>Nombre</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Email */}
          {email && (
            <div>
              <label className={styles.fieldLabel}>Email</label>
              <input
                className={`${styles.input} ${styles.inputDisabled}`}
                value={email}
                disabled
              />
              <p className={styles.inputHint}>El email no se puede modificar</p>
            </div>
          )}
        </div>

        <button className={styles.saveBtn} onClick={handleSave}>
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

export default ProfileInfoWidget;
