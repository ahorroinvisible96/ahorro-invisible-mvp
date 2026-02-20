"use client";

import React, { useState, useEffect } from 'react';
import { Card, Modal, Button } from '@/components/ui';
import { analytics } from '@/services/analytics';
import type { IncomeRangeWidgetProps, IncomeRange } from './IncomeRangeWidget.types';
import styles from './IncomeRangeWidget.module.css';

function formatRange(r: IncomeRange): string {
  return `${r.min.toLocaleString('es-ES')}€ – ${r.max.toLocaleString('es-ES')}€`;
}

export function IncomeRangeWidget({
  incomeRange,
  onSaveIncomeRange,
}: IncomeRangeWidgetProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    analytics.incomeRangeViewed();
  }, []);

  function openModal() {
    setMinVal(incomeRange ? String(incomeRange.min) : '');
    setMaxVal(incomeRange ? String(incomeRange.max) : '');
    setFormError('');
    analytics.incomeEditOpened();
    setOpen(true);
  }

  function handleSave() {
    const min = Number(minVal);
    const max = Number(maxVal);
    if (!minVal || !maxVal || isNaN(min) || isNaN(max)) {
      setFormError('Introduce valores numéricos válidos.');
      return;
    }
    if (min < 0 || max < 0) {
      setFormError('Los valores deben ser positivos.');
      return;
    }
    if (min >= max) {
      setFormError('El mínimo debe ser menor que el máximo.');
      return;
    }
    const range: IncomeRange = { min, max, currency: 'EUR' };
    onSaveIncomeRange(range);
    analytics.incomeUpdated(min, max);
    setOpen(false);
  }

  return (
    <>
      <Card
        variant="default"
        size="sm"
        rounded2xl
        className={incomeRange ? styles.cardFilled : styles.card}
      >
        <Card.Content>
          <div className={styles.row}>
            <div>
              <div className={styles.label}>Ingresos mensuales</div>
              {incomeRange ? (
                <div className={styles.value}>{formatRange(incomeRange)}</div>
              ) : (
                <div className={styles.emptyValue}>No configurado</div>
              )}
            </div>
            <button className={styles.editBtn} onClick={openModal}>
              {incomeRange ? 'Editar' : 'Configurar →'}
            </button>
          </div>
        </Card.Content>
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Editar ingresos mensuales"
        size="sm"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Mínimo mensual (€)
            <input
              type="number"
              className={styles.formInput}
              value={minVal}
              min={0}
              onChange={(e) => { setMinVal(e.target.value); setFormError(''); }}
              placeholder="ej: 2000"
            />
          </label>
          <label className={styles.formLabel}>
            Máximo mensual (€)
            <input
              type="number"
              className={styles.formInput}
              value={maxVal}
              min={0}
              onChange={(e) => { setMaxVal(e.target.value); setFormError(''); }}
              placeholder="ej: 3500"
            />
          </label>
          {formError && <p className={styles.formError}>{formError}</p>}
        </div>
      </Modal>
    </>
  );
}

export default IncomeRangeWidget;
