"use client";

import React, { useState, useCallback } from 'react';
import {
  PROFILING_QUESTIONS,
  computeProfilingResult,
  saveProfilingResult,
  type ProfilingAnswer,
} from '@/services/profilingService';
import styles from './ProfilingModal.module.css';

type ModalPhase = 'intro' | 'questions' | 'done';

interface ProfilingModalProps {
  onClose: () => void;
  onCompleted?: () => void;
}

export function ProfilingModal({ onClose, onCompleted }: ProfilingModalProps) {
  const [phase, setPhase]       = useState<ModalPhase>('intro');
  const [qIndex, setQIndex]     = useState(0);
  const [answers, setAnswers]   = useState<ProfilingAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  const totalQ = PROFILING_QUESTIONS.length;
  const currentQ = PROFILING_QUESTIONS[qIndex];

  const handleSelect = useCallback((optIdx: number) => {
    if (animating) return;
    setSelected(optIdx);

    const option = currentQ.options[optIdx];
    const answer: ProfilingAnswer = {
      questionIdx: qIndex,
      optionIdx: optIdx,
      avatar: option.avatar,
      subavatar: option.subavatar,
    };

    setAnimating(true);
    setTimeout(() => {
      const newAnswers = [...answers, answer];
      setAnswers(newAnswers);

      if (qIndex + 1 < totalQ) {
        setQIndex(qIndex + 1);
        setSelected(null);
      } else {
        // Terminó: calcular y guardar
        const result = computeProfilingResult(newAnswers);
        saveProfilingResult(result);
        setPhase('done');
      }
      setAnimating(false);
    }, 350);
  }, [animating, answers, currentQ, qIndex, totalQ]);

  const handleDone = useCallback(() => {
    onCompleted?.();
    onClose();
  }, [onClose, onCompleted]);

  // ── Overlay + contenido ────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ═══ Intro ═══ */}
        {phase === 'intro' && (
          <div className={styles.introBody}>
            {/* Icono decorativo */}
            <div className={styles.introIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26Z" />
              </svg>
            </div>

            <h2 className={styles.introTitle}>Personaliza aún más tu experiencia</h2>

            <p className={styles.introText}>
              Responde unas preguntas rápidas para que Ahorro Invisible pueda adaptarse mejor a ti,
              a tus hábitos y a tu forma de ahorrar. Cuanta más información compartas, más precisas
              podrán ser tus recomendaciones, tus objetivos y tu experiencia dentro de la app.
            </p>

            <div className={styles.introBtns}>
              <button className={styles.primaryBtn} onClick={() => setPhase('questions')}>
                Empezar
              </button>
              <button className={styles.secondaryBtn} onClick={onClose}>
                Más tarde
              </button>
            </div>
          </div>
        )}

        {/* ═══ Preguntas ═══ */}
        {phase === 'questions' && currentQ && (
          <div className={styles.questionBody}>
            {/* Barra de progreso */}
            <div className={styles.progressBar}>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }}
                />
              </div>
              <span className={styles.progressLabel}>{qIndex + 1} / {totalQ}</span>
            </div>

            <h3 className={styles.questionTitle}>{currentQ.text}</h3>

            <div className={styles.optionsList}>
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  className={`${styles.optionBtn} ${selected === i ? styles.optionSelected : ''}`}
                  onClick={() => handleSelect(i)}
                  disabled={animating}
                >
                  <span className={styles.optionLetter}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={styles.optionText}>{opt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Completado ═══ */}
        {phase === 'done' && (
          <div className={styles.doneBody}>
            <div className={styles.doneIcon}>✨</div>
            <h2 className={styles.doneTitle}>¡Listo!</h2>
            <p className={styles.doneText}>
              Hemos actualizado tu perfil. A partir de ahora, tu experiencia será
              más personalizada y adaptada a ti.
            </p>
            <button className={styles.primaryBtn} onClick={handleDone}>
              Continuar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProfilingModal;
