# Measuring Lineup Synergy in the LPL

**Group members:** Terasa Tu， Xuye Chen  
**Course:** STATS 401 Final Visualization Project

## 1. Topic, Goals, and Questions

Professional *League of Legends* is team-oriented, yet players are often judged with individual statistics such as KDA, damage, gold, and win rate. These measures do not fully account for role expectations, opponents, resource allocation, or teammates. Our project will examine **lineup synergy in the League of Legends Pro League (LPL)** and show why particular combinations perform well together.

Our coordinated, interactive visualization will move from **player → pair → lineup**. It will help users compare context-adjusted performance, discover teammate relationships, and recognize resource-allocation structures. The intended audience is LPL fans, esports analysts, and viewers who want to understand strategy through data rather than simply rank players.

The visualization will address five questions:

1. How does a player perform relative to expectations for their role, champion, opponent, patch, side, and team context?
2. Which players are associated with stronger-than-expected performances from their teammates?
3. Which player pairs and five-player lineups show unusually strong or weak synergy?
4. How are gold, damage, vision, and objective participation distributed within successful lineups?
5. When the model is sufficiently reliable, how might replacing one player change a lineup’s expected performance?

## 2. Datasets

Our primary source is [Oracle’s Elixir](https://oracleselixir.com/tools/downloads), an open collection of professional League of Legends match data. We will download the annual CSV files and filter them to the LPL. Our current 2025 extract contains approximately **8,050 player-game records**; expanding across recent seasons should produce tens of thousands of rows. The raw files contain more than 100 variables, although the analysis-ready tables will retain roughly 25–40.

Each row represents one player in one game. Important attributes include game ID, date, patch, split, team, opponent, side, player, position, champion, result, kills, deaths, assists, gold share, damage share, vision score, objectives, and time-based gold/experience/CS differences. We will standardize names and types, remove incomplete or duplicated records, derive opponent and lineup identifiers, normalize statistics by role and patch, and aggregate player-game data into player, pair, team, and lineup tables. Raw and processed files will remain separate for reproducibility.

## 3. Analysis and Visualization Methods

We will use Python with pandas or Polars for cleaning and aggregation, and scikit-learn for prediction and evaluation. Candidate models include regularized regression and tree-based methods with time-aware validation. Predictions will become residual measures—actual minus expected performance—before pair or lineup summaries are calculated. We will report uncertainty and sample size so a two-game pair is not presented like a long-running duo.

D3.js, HTML, and CSS will power the web interface. Five linked idioms will support complementary tasks: a **scatterplot** for comparing resource share and adjusted impact; a **time-series chart** for trends and expected-versus-actual performance; a **heatmap** for pairwise synergy; a **network graph** for relationship structure within a lineup; and **parallel coordinates** for multidimensional lineup profiles. Shared filters for season, team, role, patch, and minimum games will coordinate the views. Together they support comparison, filtering, trend identification, relationship discovery, and outlier detection.

## 4. Visualization Sketches and Reference

The interface is inspired by [Top Teams League](https://topteamsleague.web.app/) but extends its player-comparison approach with expected performance and teammate synergy.

```text
SCATTERPLOT                 TIME SERIES
impact ↑      •            performance ↑   /\__ actual
       |  •       •                    ····· expected
       |     •                           └────────→ time
       └────────→ gold share
```

1. **Resource–impact scatterplot:** reveals players who produce more or less adjusted impact than their resource share suggests.
2. **Performance timeline:** shows when actual performance rises above or falls below the historical expectation.

```text
SYNERGY HEATMAP             LINEUP NETWORK          PARALLEL COORDINATES
      A  B  C  D            A ─── B                 gold  damage vision
 A    ·  ▓  ░  ▒             \   /                    ●────╲────●
 B    ▓  ·  ▒  ░              \ /                     ●──╲──●───●
 C    ░  ▒  ·  ▓               C ─── D                 ●────●╲──●
```

3. **Synergy heatmap:** makes strong and weak player pairs easy to scan and compare.
4. **Lineup network:** reveals whether synergy is balanced across five players or concentrated around one connector.
5. **Parallel coordinates:** compares lineup profiles across gold, damage, vision, objectives, impact, and synergy.

## 5. Group Roles and Responsibilities

**Terasa Tu** will lead data acquisition, cleaning, feature engineering, predictive modeling, validation, and production of analytical measures. **Xuye Chen** will lead visualization design, D3.js implementation, interaction design, interface development, and usability testing. Both members will refine questions, review each other’s work, integrate the analysis with the interface, write documentation, and prepare the interim and final presentations.

## 6. Interim Presentation Deliverables

For the interim presentation, we will demonstrate an end-to-end vertical slice: the acquired and cleaned LPL data; a short exploratory analysis; refined questions and metric definitions; baseline expected-performance results with validation; five updated visualization sketches; and an initial D3.js prototype connecting at least one player selection to a second view. We will also explain remaining modeling risks, particularly small pair samples and roster changes.

## 7. Timeline and Milestones

| Week | Milestone | Tasks | Responsible Member(s) | Expected Output |
|---|---|---|---|---|
| 2 | Project definition | Confirm scope, seasons, questions, and success criteria | Both | Approved proposal and source inventory |
| 3 | Data preparation | Download, clean, join, validate, and explore LPL records | Terasa; Xuye reviews | Reproducible dataset and EDA summary |
| 4 | Visualization design | Define metrics, models, interactions, and five sketches | Terasa: metrics; Xuye: designs | Baseline model and annotated wireframes |
| 5 | Interim prototype | Connect processed data to linked D3 views and test filters | Both | Presentable end-to-end prototype |
| 6 | Implementation and refinement | Complete views, evaluate models, add uncertainty, test usability | Terasa: validation; Xuye: interface | Feature-complete beta and issue list |
| 7 | Final integration | Fix issues, polish narrative, document, rehearse, and deploy | Both | Final website, repository, and presentation |
