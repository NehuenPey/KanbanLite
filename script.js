(function () {
  "use strict";

  var STORAGE_KEY = "trello-lite-board-v1";
  var ACCENTS = ["#2383E2", "#0F7B6C", "#D9730D", "#9065B0", "#E03E3E"];

  var defaultBoard = function () {
    return {
      title: "Mi tablero",
      columns: [
        {
          id: uid(),
          title: "Por hacer",
          color: ACCENTS[0],
          cards: [
            { id: uid(), text: "Arrastrá las tarjetas entre columnas" },
            { id: uid(), text: "Hacé click en una tarjeta para editarla" },
          ],
        },
        { id: uid(), title: "En progreso", color: ACCENTS[1], cards: [] },
        { id: uid(), title: "Hecho", color: ACCENTS[2], cards: [] },
      ],
    };
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadBoard() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultBoard();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.columns)) return defaultBoard();
      return parsed;
    } catch (e) {
      console.warn("No se pudo leer el tablero guardado, empiezo de cero.", e);
      return defaultBoard();
    }
  }

  function saveBoard() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch (e) {
      console.warn("No se pudo guardar el tablero.", e);
    }
  }

  var board = loadBoard();
  var boardEl = document.getElementById("board");
  var titleInput = document.getElementById("board-title");

  titleInput.value = board.title || "Mi tablero";
  titleInput.addEventListener("input", function () {
    board.title = titleInput.value;
    saveBoard();
  });

  // ---------- render ----------

  var dragCardId = null;
  var dragFromCol = null;
  var dragColId = null;

  function render() {
    boardEl.innerHTML = "";

    board.columns.forEach(function (col, colIndex) {
      var colEl = document.createElement("div");
      colEl.className = "column";
      colEl.dataset.colId = col.id;

      // header
      var headerEl = document.createElement("div");
      headerEl.className = "col-header";
      headerEl.draggable = true;
      headerEl.dataset.colId = col.id;

      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.setProperty(
        "--dot-color",
        col.color || ACCENTS[colIndex % ACCENTS.length],
      );

      var colTitle = document.createElement("input");
      colTitle.className = "col-title";
      colTitle.value = col.title;
      colTitle.maxLength = 30;
      colTitle.addEventListener("input", function () {
        col.title = colTitle.value;
        saveBoard();
      });
      colTitle.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });

      var colCount = document.createElement("span");
      colCount.className = "col-count";
      colCount.textContent = col.cards.length;

      var colDel = document.createElement("button");
      colDel.className = "col-del";
      colDel.title = "Eliminar columna";
      colDel.textContent = "×";
      colDel.addEventListener("click", function () {
        if (
          col.cards.length === 0 ||
          confirm(
            'Eliminar "' +
              col.title +
              '" y sus ' +
              col.cards.length +
              " tarjeta(s)?",
          )
        ) {
          board.columns.splice(colIndex, 1);
          saveBoard();
          render();
        }
      });

      headerEl.appendChild(dot);
      headerEl.appendChild(colTitle);
      headerEl.appendChild(colCount);
      headerEl.appendChild(colDel);

      headerEl.addEventListener("dragstart", function (e) {
        dragColId = col.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "col:" + col.id);
      });
      headerEl.addEventListener("dragend", function () {
        dragColId = null;
        render();
      });

      // body / cards
      var body = document.createElement("div");
      body.className = "col-body";

      var cardsWrap = document.createElement("div");
      cardsWrap.className = "cards";

      col.cards.forEach(function (card, cardIndex) {
        cardsWrap.appendChild(renderCard(card, col, cardIndex));
      });

      if (col.cards.length === 0) {
        var hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "Sin tarjetas";
        cardsWrap.appendChild(hint);
      }

      body.appendChild(cardsWrap);

      // add-card form
      var form = document.createElement("div");
      form.className = "add-card-form";
      var row = document.createElement("div");
      row.className = "add-card-row";
      var plus = document.createElement("span");
      plus.textContent = "+";
      var input = document.createElement("input");
      input.className = "add-card-input";
      input.placeholder = "Agregar tarjeta";
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && input.value.trim()) {
          col.cards.push({ id: uid(), text: input.value.trim() });
          saveBoard();
          render();
        }
      });
      row.appendChild(plus);
      row.appendChild(input);
      form.appendChild(row);
      body.appendChild(form);

      // dnd targets on the column body
      body.addEventListener("dragover", function (e) {
        if (dragCardId == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        var placeholder = ensurePlaceholder(cardsWrap);
        var after = getCardAfterY(cardsWrap, e.clientY);
        if (after == null) {
          cardsWrap.appendChild(placeholder);
        } else {
          cardsWrap.insertBefore(placeholder, after);
        }
      });
      body.addEventListener("dragleave", function (e) {
        if (e.target === body) {
          removePlaceholder(cardsWrap);
        }
      });
      body.addEventListener("drop", function (e) {
        if (dragCardId == null) return;
        e.preventDefault();
        var placeholder = cardsWrap.querySelector(".drop-placeholder");
        var index = placeholder
          ? Array.prototype.indexOf.call(cardsWrap.children, placeholder)
          : col.cards.length;

        var fromCol = board.columns.find(function (c) {
          return c.id === dragFromCol;
        });
        var cardObj = fromCol.cards.find(function (c) {
          return c.id === dragCardId;
        });
        if (!cardObj) return;

        fromCol.cards = fromCol.cards.filter(function (c) {
          return c.id !== dragCardId;
        });
        if (fromCol.id === col.id && index > fromCol.cards.length)
          index = fromCol.cards.length;
        col.cards.splice(Math.min(index, col.cards.length), 0, cardObj);

        dragCardId = null;
        dragFromCol = null;
        saveBoard();
        render();
      });

      colEl.appendChild(headerEl);
      colEl.appendChild(body);

      // column reorder drop zone (drop on the column itself, outside cards)
      colEl.addEventListener("dragover", function (e) {
        if (dragColId == null || dragColId === col.id) return;
        e.preventDefault();
      });
      colEl.addEventListener("drop", function (e) {
        if (dragColId == null || dragColId === col.id) return;
        e.preventDefault();
        var fromIndex = board.columns.findIndex(function (c) {
          return c.id === dragColId;
        });
        var toIndex = board.columns.findIndex(function (c) {
          return c.id === col.id;
        });
        var moved = board.columns.splice(fromIndex, 1)[0];
        board.columns.splice(toIndex, 0, moved);
        dragColId = null;
        saveBoard();
        render();
      });

      boardEl.appendChild(colEl);
    });

    // new column control
    var newColWrap = document.createElement("div");
    newColWrap.className = "new-column";
    var newColBtn = document.createElement("button");
    newColBtn.className = "new-column-btn";
    newColBtn.textContent = "+ Nueva columna";
    newColBtn.addEventListener("click", function () {
      board.columns.push({
        id: uid(),
        title: "Nueva columna",
        color: ACCENTS[board.columns.length % ACCENTS.length],
        cards: [],
      });
      saveBoard();
      render();
      var newTitles = boardEl.querySelectorAll(".col-title");
      var last = newTitles[newTitles.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
    });
    newColWrap.appendChild(newColBtn);
    boardEl.appendChild(newColWrap);
  }

  function renderCard(card, col, cardIndex) {
    var el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    el.draggable = true;

    var textEl = document.createElement("div");
    textEl.className = "card-text";
    textEl.textContent = card.text;
    el.appendChild(textEl);

    var delBtn = document.createElement("button");
    delBtn.className = "card-del";
    delBtn.title = "Eliminar tarjeta";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      col.cards.splice(cardIndex, 1);
      saveBoard();
      render();
    });
    el.appendChild(delBtn);

    el.addEventListener("click", function (e) {
      if (e.target === delBtn) return;
      startEdit(el, card, col);
    });

    el.addEventListener("dragstart", function (e) {
      dragCardId = card.id;
      dragFromCol = col.id;
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "card:" + card.id);
    });
    el.addEventListener("dragend", function () {
      dragCardId = null;
      dragFromCol = null;
      document.querySelectorAll(".drop-placeholder").forEach(function (p) {
        p.remove();
      });
      render();
    });

    return el;
  }

  function startEdit(el, card, col) {
    if (el.querySelector("textarea")) return;
    var textEl = el.querySelector(".card-text");
    var textarea = document.createElement("textarea");
    textarea.value = card.text;
    textarea.rows = Math.max(2, Math.ceil(card.text.length / 24));
    el.replaceChild(textarea, textEl);
    el.draggable = false;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    function commit() {
      var v = textarea.value.trim();
      card.text = v || card.text;
      saveBoard();
      render();
    }
    textarea.addEventListener("blur", commit);
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      }
      if (e.key === "Escape") {
        textarea.value = card.text;
        textarea.blur();
      }
    });
  }

  function ensurePlaceholder(cardsWrap) {
    var existing = cardsWrap.querySelector(".drop-placeholder");
    if (existing) return existing;
    var hint = cardsWrap.querySelector(".empty-hint");
    if (hint) hint.remove();
    var p = document.createElement("div");
    p.className = "drop-placeholder";
    cardsWrap.appendChild(p);
    return p;
  }
  function removePlaceholder(cardsWrap) {
    var existing = cardsWrap.querySelector(".drop-placeholder");
    if (existing) existing.remove();
  }
  function getCardAfterY(cardsWrap, y) {
    var els = Array.prototype.slice.call(
      cardsWrap.querySelectorAll(".card:not(.dragging)"),
    );
    var result = null;
    var closestOffset = -Infinity;
    els.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        result = child;
      }
    });
    return result;
  }

  render();
})();
