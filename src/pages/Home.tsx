import { ArrowRight, ArrowUpRight, CalendarDays, Flame, Weight, Zap, Check } from 'lucide-react';
import { useState } from 'react';
import { useData } from '../lib/store';
import { DAYS } from '../lib/types';
import { loadLabel, number, resolveLoad, sessionProgress } from '../lib/training';
import { Button, Empty, useApp } from '../components/UI';

export function Home() {
  const { profile, programs, exercises, sessions, weights } = useData();
  const { navigate, start } = useApp();
  const today = new Date();
  const next = [...programs].sort(
    (a, b) => ((a.weekday - today.getDay() + 7) % 7) - ((b.weekday - today.getDay() + 7) % 7),
  )[0];
  const [selected, setSelected] = useState(next?.id);
  const program = programs.find((p) => p.id === selected) ?? next;
  const active = sessions.find((s) => s.status === 'active');
  const completed = sessions.filter((s) => s.status === 'completed');
  const bodyweight = weights.at(-1)?.kg ?? profile!.bodyweight;
  const startWeek = new Date(today);
  startWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  startWeek.setHours(0, 0, 0, 0);
  const weekSessions = completed.filter((s) => new Date(s.startedAt) >= startWeek).length;
  return (
    <>
      <div className="home-intro">
        <div>
          <div className="eyebrow">TON CARNET DE STREET LIFTING</div>
          <h1>
            Salut {profile!.name || 'athlète'}
            <span className="lime">.</span>
            <br />
            <span className="muted">Prêt à passer un cap ?</span>
          </h1>
        </div>
        <span className="date-pill">
          <CalendarDays size={16} />
          {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <Flame size={20} />
          </span>
          <div>
            <span className="small-label">CETTE SEMAINE</span>
            <div className="stat-value">
              {weekSessions}
              <small> / {programs.length} séances</small>
            </div>
          </div>
          <span className="stat-foot">On construit la régularité.</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Weight size={20} />
          </span>
          <div>
            <span className="small-label">POIDS DE CORPS</span>
            <div className="stat-value">
              {number(bodyweight)}
              <small> kg</small>
            </div>
          </div>
          <span className="stat-foot">
            {weights.length ? 'Dernière pesée' : 'Poids de référence · à confirmer'} · cat. −
            {number(profile!.category)} kg
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Zap size={20} />
          </span>
          <div>
            <span className="small-label">DANS LE CARNET</span>
            <div className="stat-value">
              {completed.length}
              <small> séance{completed.length !== 1 ? 's' : ''}</small>
            </div>
          </div>
          <button className="text-link stat-foot" onClick={() => navigate('progress')}>
            Voir ma progression <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      {active && (
        <button className="resume-banner" onClick={() => navigate('workout')}>
          <span className="pulse" />
          <span>
            <strong>Ta séance t’attend.</strong> {active.programName} ·{' '}
            {sessionProgress(active).percent} % validé
          </span>
          <ArrowRight size={21} />
        </button>
      )}
      <div className="home-columns">
        <section className="session-preview card">
          <div className="section-head">
            <div className="eyebrow">LE PROGRAMME</div>
            <span className="tag">
              {program?.weekday === today.getDay() ? 'AUJOURD’HUI' : '4 JOURS · TON RYTHME'}
            </span>
          </div>
          <div className="day-tabs" role="group" aria-label="Jour du programme">
            {programs.map((p) => (
              <button
                key={p.id}
                className={program?.id === p.id ? 'selected' : ''}
                onClick={() => setSelected(p.id)}
              >
                {DAYS[p.weekday].slice(0, 3)}
                <span>{p.exercises.length} exos</span>
              </button>
            ))}
          </div>
          {program ? (
            <>
              <div className="preview-title">
                <span className="small-label">{DAYS[program.weekday].toUpperCase()}</span>
                <h2>{program.name}</h2>
                <p>{program.exercises.length} exercices · des séries, pas de paperasse.</p>
              </div>
              <div className="preview-exercises">
                {program.exercises.map((p, i) => {
                  const definition = exercises.find((e) => e.id === p.exerciseId);
                  if (!definition) return null;
                  const peak = p.blocks.find((b) => b.phase === 'Pic') ?? p.blocks[0];
                  return (
                    <div className="preview-exercise" key={p.id}>
                      <span className="exercise-number">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{definition.name}</strong>
                        <span>
                          {p.intent} · {peak.sets} × {peak.reps} au pic
                        </span>
                      </div>
                      <b>
                        {loadLabel(
                          resolveLoad(peak, definition, profile!, bodyweight),
                          definition.weighted,
                        )}
                      </b>
                    </div>
                  );
                })}
              </div>
              {program.skills && <p className="skills-note">+ {program.skills}</p>}
              <Button className="primary wide" onClick={() => start(program.id)}>
                {active ? 'Reprendre ma séance' : 'Démarrer la séance'}
                <ArrowRight size={20} />
              </Button>
            </>
          ) : (
            <Empty title="Ton programme commence ici">
              <button className="text-link" onClick={() => navigate('program')}>
                Créer une séance
              </button>
            </Empty>
          )}
        </section>
        <aside className="home-side">
          <section className="card references">
            <div className="section-head">
              <h3>Les points de départ</h3>
              <ArrowUpRight size={20} />
            </div>
            <p className="muted small">
              Tes références de programmation, modifiables à tout moment.
            </p>
            {exercises.slice(0, 4).map((e) => (
              <div className="reference-row" key={e.id}>
                <div>
                  <span>{e.shortName}</span>
                  <small>{e.reliability}</small>
                </div>
                <strong>{loadLabel(e.reference, e.weighted)}</strong>
              </div>
            ))}
            <button className="text-link" onClick={() => navigate('settings')}>
              Ajuster mes références <ArrowRight size={15} />
            </button>
          </section>
          <section className="quiet-card">
            <span className="eyebrow">FOCUS SUR L’ESSENTIEL</span>
            <h3>
              Une série.
              <br />
              Un geste.
              <br />
              <span className="lime">C’est enregistré.</span>
            </h3>
            <p>Tu coches, le carnet suit. Même sans réseau.</p>
            <div className="mini-check">
              <Check size={14} /> Sauvegarde locale automatique
            </div>
          </section>
        </aside>
      </div>
      <div className="section-head bottom-heading">
        <h2>La semaine en vue</h2>
        <button className="text-link" onClick={() => navigate('program')}>
          Modifier <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="week-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const p = programs.filter((p) => p.weekday === day);
          return (
            <button
              key={day}
              className={`week-day ${day === today.getDay() ? 'today' : ''} ${p.length ? 'training-day' : ''}`}
              onClick={() => {
                if (p[0]) setSelected(p[0].id);
              }}
              disabled={!p.length}
            >
              <span>
                {DAYS[day].slice(0, 3).toUpperCase()}
                {day === today.getDay() && <i />}
              </span>
              <strong>{p.length ? p[0].name : 'Récupération'}</strong>
              <small>
                {p.length ? `${p[0].exercises.length} exercices` : 'Recharge les batteries'}
              </small>
            </button>
          );
        })}
      </div>
      <p className="footnote">
        Base initiale à personnaliser. Les références et les charges d’entraînement restent
        indépendantes de l’historique.
      </p>
    </>
  );
}
