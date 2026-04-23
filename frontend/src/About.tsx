import React from 'react';
import './About.css';

function About() {
  return (
    <div className="about">
      <h1 className="about-header">About Jira Autofix</h1>
      <section className="about-section">
        <h2>How it works</h2>
        <ol className="about-steps">
          <li><span className="step-number">1.</span> Jira issue created</li>
          <li><span className="step-number">2.</span> Synced to GitHub</li>
          <li><span className="step-number">3.</span> AI generates fix</li>
          <li><span className="step-number">4.</span> PR auto-created</li>
        </ol>
      </section>
      <section className="about-section">
        <h2>Tech Stack</h2>
        <ul className="about-tech-list">
          <li>React</li>
          <li>GitHub Actions</li>
          <li>GitHub Copilot CLI</li>
          <li>Jira REST API</li>
        </ul>
      </section>
      <section className="about-section">
        <h2>Pipeline Status</h2>
        <span className="about-badge about-badge-active">Active</span>
      </section>
    </div>
  );
}

export default About;
