#!/bin/bash

SESSION="tf2-automatic"

tmux has-session -t $SESSION 2>/dev/null

if [[ $? -ne 0 ]]; then
  tmux new-session -d -s $SESSION -n "editor"

  tmux new-window -t $SESSION -n "terminal"
  tmux send-keys -t $SESSION:terminal "node ./scripts/nx.js run-many -t lint --all" C-m

  tmux new-window -t $SESSION -n "test"
  tmux send-keys -t $SESSION:test "node ./scripts/nx.js affected -t test" C-m

  tmux new-window -t $SESSION -n "docker"
  tmux send-keys -t $SESSION:docker "docker compose up -d" C-m
  tmux send-keys -t $SESSION:docker "docker compose logs -f" C-m

  tmux select-window -t $SESSION:editor
fi

if [ -n "$TMUX" ]; then
  tmux switch-client -t $SESSION
else
  tmux attach-session -t $SESSION
fi
