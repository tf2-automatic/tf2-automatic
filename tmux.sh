#!/bin/bash

SESSION="tf2-automatic"

window_exists() {
  window_name=$1
  tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -Fxq "$window_name"
}

window_has_multiple_panes() {
  window_name=$1

  if ! window_exists "$window_name"; then
    return 0
  fi

  pane_count=$(tmux list-panes -t "$SESSION:$window_name" 2>/dev/null | wc -l)
  ((pane_count > 1))
}

is_pane_idle() {
  pane_id=$1
  current_cmd=$(tmux display-message -p -t "$pane_id" "#{pane_current_command}" 2>/dev/null)
  default_shell=$(basename "$SHELL")

  [[ "$current_cmd" == "$default_shell" ]]
}

is_window_idle() {
  window_name=$1

  if ! window_exists "$window_name"; then
    return 0
  fi

  if window_has_multiple_panes "$window_name"; then
    return 1
  fi

  is_pane_idle "$SESSION:$window_name"
}

ensure_window_exists() {
  window_name=$1

  if ! window_exists "$window_name"; then
    tmux new-window -t "$SESSION" -n "$window_name"
  fi
}

ensure_window_and_run() {
  window_name=$1
  command=$2
  window_target="$SESSION:$window_name"

  ensure_window_exists "$window_name"

  if is_window_idle "$window_name"; then
    tmux send-keys -t "$window_target" C-c
    if [[ "$command" != "clear" ]]; then
      tmux send-keys -t "$window_target" clear C-m
    fi
    tmux send-keys -t "$window_target" "$command" C-m
  fi
}

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -n editor
fi

ensure_window_and_run "terminal" "node ./scripts/nx.js run-many -t lint --all"
ensure_window_and_run "test" "node ./scripts/nx.js affected -t test"
ensure_window_and_run "docker" "docker compose up -d && docker compose logs -f"

tmux select-window -t "$SESSION:editor"

if [[ -n "$TMUX" ]]; then
  current_session=$(tmux display-message -p '#S')
  current_window=$(tmux display-message -p '#W')

  if [[ "$current_session" == "$SESSION" && "$current_window" == "editor" ]]; then
    clear
  fi

  tmux switch-client -t "$SESSION"
else
  tmux attach-session -t "$SESSION"
fi
