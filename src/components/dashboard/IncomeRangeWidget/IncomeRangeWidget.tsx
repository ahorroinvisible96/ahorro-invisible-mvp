"use client";

import React, { useEffect } from 'react';
import { Card } from '@/components/ui';
import { analytics } from '@/services/analytics';
import type { IncomeRangeWidgetProps } from './IncomeRangeWidget.types';
import styles from './IncomeRangeWidget.module.css';

export function IncomeRangeWidget({
  incomeRange,
  onEditIncomeRange,
}: IncomeRangeWidgetProps): React.ReactElement {
  useEffect(() => {
    analytics.savingsEvolutionRangeChanged('30d', 'demo');
  }, [incomeRange]);

  return (
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
              <div className={styles.value}>{incomeRange}</div>
            ) : (
              <div className={styles.emptyValue}>No configurado</div>
            )}
          </div>
          <button className={styles.editBtn} onClick={onEditIncomeRange}>
            {incomeRange ? 'Editar' : 'Configurar →'}
          </button>
        </div>
      </Card.Content>
    </Card>
  );
}

export default IncomeRangeWidget;
