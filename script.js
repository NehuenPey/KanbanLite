(function () {
  "use strict";

  /* ---------- Tema ---------- */

  var THEME_KEY = "trello-lite-theme";
  var themeToggle = document.getElementById("theme-toggle");

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
  });

  /* ---------- Estado ---------- */

  var STORAGE_KEY = "trello-lite-board-v1";
  var ACCENTS = ["#2383E2", "#0F7B6C", "#D9730D", "#9065B0", "#E03E3E"];
  var DRAG_THRESHOLD = 8; // px de movimiento antes de considerarlo un arrastre
  var EDGE_ZONE = 70; // px desde el borde de #board donde arranca el auto-scroll
  var EDGE_MIN_SPEED = 6; // px por frame al borde de la zona
  var EDGE_MAX_SPEED = 26; // px por frame pegado al borde de la pantalla

  var defaultBoard = function () {
    return {
      title: "Mi tablero",
      columns: [
        {
          id: uid(),
          title: "Por hacer",
          color: ACCENTS[0],
          cards: [
            { id: uid(), text: "Mantené presionada una tarjeta para moverla" },
            { id: uid(), text: "Tocá una tarjeta para editarla" },
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
  var dotsEl = document.getElementById("page-dots");

  titleInput.value = board.title || "Mi tablero";
  titleInput.addEventListener("input", function () {
    board.title = titleInput.value;
    saveBoard();
  });

  /* ---------- Render ---------- */

  function render() {
    boardEl.innerHTML = "";

    board.columns.forEach(function (col, colIndex) {
      var colEl = document.createElement("div");
      colEl.className = "column";
      colEl.dataset.colId = col.id;

      // header
      var headerEl = document.createElement("div");
      headerEl.className = "col-header";
      headerEl.dataset.colId = col.id;

      var handle = document.createElement("span");
      handle.className = "col-handle";
      handle.title = "Arrastrar para reordenar";
      handle.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>';

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

      headerEl.appendChild(handle);
      headerEl.appendChild(dot);
      headerEl.appendChild(colTitle);
      headerEl.appendChild(colCount);
      headerEl.appendChild(colDel);

      bindColumnDrag(handle, col.id);

      // body / cards
      var body = document.createElement("div");
      body.className = "col-body";
      body.dataset.colId = col.id;

      var cardsWrap = document.createElement("div");
      cardsWrap.className = "cards";
      cardsWrap.dataset.colId = col.id;

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
      plus.className = "add-card-plus";
      plus.textContent = "+";
      var input = document.createElement("input");
      input.className = "add-card-input";
      input.placeholder = "Agregar tarjeta";
      input.setAttribute("enterkeyhint", "done");
      input.setAttribute("autocomplete", "off");

      var submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.className = "add-card-submit";
      submitBtn.title = "Agregar tarjeta";
      submitBtn.setAttribute("aria-label", "Agregar tarjeta");
      submitBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>';

      function commitNewCard() {
        var v = input.value.trim();
        if (!v) return;
        col.cards.push({ id: uid(), text: v });
        saveBoard();
        render();
      }

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitNewCard();
        }
      });
      submitBtn.addEventListener("click", function () {
        commitNewCard();
        input.focus();
      });
      input.addEventListener("input", function () {
        row.classList.toggle("has-text", input.value.trim().length > 0);
      });

      row.appendChild(plus);
      row.appendChild(input);
      row.appendChild(submitBtn);
      form.appendChild(row);
      body.appendChild(form);

      colEl.appendChild(headerEl);
      colEl.appendChild(body);
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

    renderDots();
  }

  function renderCard(card, col, cardIndex) {
    var el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;

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

    bindCardDrag(el, delBtn, card, col);

    return el;
  }

  function startEdit(el, card, col) {
    if (el.querySelector("textarea")) return;
    var textEl = el.querySelector(".card-text");
    if (!textEl) return;
    var textarea = document.createElement("textarea");
    textarea.value = card.text;
    textarea.rows = Math.max(2, Math.ceil(card.text.length / 24));
    el.replaceChild(textarea, textEl);
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

  /* ---------- Paginación (móvil) ---------- */

  function renderDots() {
    dotsEl.innerHTML = "";
    if (board.columns.length < 2) return;
    board.columns.forEach(function (col, i) {
      var d = document.createElement("span");
      d.className = "page-dot" + (i === 0 ? " active" : "");
      d.dataset.index = i;
      d.addEventListener("click", function () {
        var target = boardEl.children[i];
        if (target)
          target.scrollIntoView({
            behavior: "smooth",
            inline: "start",
            block: "nearest",
          });
      });
      dotsEl.appendChild(d);
    });
  }

  var dotsTicking = false;
  boardEl.addEventListener("scroll", function () {
    if (dotsTicking) return;
    dotsTicking = true;
    requestAnimationFrame(function () {
      updateActiveDot();
      dotsTicking = false;
    });
  });

  function updateActiveDot() {
    var dots = dotsEl.querySelectorAll(".page-dot");
    if (!dots.length) return;
    var columns = boardEl.querySelectorAll(".column");
    var boardCenter = boardEl.scrollLeft + boardEl.clientWidth / 2;
    var closest = 0;
    var closestDist = Infinity;
    columns.forEach(function (colEl, i) {
      var center = colEl.offsetLeft + colEl.offsetWidth / 2;
      var dist = Math.abs(center - boardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    dots.forEach(function (d, i) {
      d.classList.toggle("active", i === closest);
    });
  }

  /* ---------- Utilidades compartidas de drag ---------- */

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
  function removeAllPlaceholders() {
    document.querySelectorAll(".drop-placeholder").forEach(function (p) {
      p.remove();
    });
  }
  function getCardAfterY(cardsWrap, y) {
    var els = Array.prototype.slice.call(cardsWrap.querySelectorAll(".card"));
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

  var edgeScrollRAF = null;
  var edgeScrollDir = 0;
  var edgeScrollSpeed = 0;
  var snapLockCount = 0;

  function lockSnap() {
    snapLockCount++;
    boardEl.style.scrollSnapType = "none";
  }
  function unlockSnap() {
    snapLockCount = Math.max(0, snapLockCount - 1);
    if (snapLockCount === 0) boardEl.style.scrollSnapType = "";
  }

  function startEdgeScrollLoop() {
    lockSnap();
    if (edgeScrollRAF) return;
    function step() {
      if (edgeScrollDir !== 0) {
        boardEl.scrollLeft += edgeScrollDir * edgeScrollSpeed;
      }
      edgeScrollRAF = requestAnimationFrame(step);
    }
    edgeScrollRAF = requestAnimationFrame(step);
  }
  function stopEdgeScrollLoop() {
    if (edgeScrollRAF) {
      cancelAnimationFrame(edgeScrollRAF);
      edgeScrollRAF = null;
    }
    edgeScrollDir = 0;
    edgeScrollSpeed = 0;
    unlockSnap();
  }
  function updateEdgeScroll(clientX) {
    var rect = boardEl.getBoundingClientRect();
    var leftDist = clientX - rect.left;
    var rightDist = rect.right - clientX;

    if (leftDist < EDGE_ZONE) {
      edgeScrollDir = -1;
      edgeScrollSpeed = speedForDistance(leftDist);
    } else if (rightDist < EDGE_ZONE) {
      edgeScrollDir = 1;
      edgeScrollSpeed = speedForDistance(rightDist);
    } else {
      edgeScrollDir = 0;
      edgeScrollSpeed = 0;
    }
  }
  function speedForDistance(dist) {
    var t = 1 - Math.max(0, Math.min(EDGE_ZONE, dist)) / EDGE_ZONE; // 0 (borde de la zona) .. 1 (pegado al borde)
    return EDGE_MIN_SPEED + t * (EDGE_MAX_SPEED - EDGE_MIN_SPEED);
  }

  /* ---------- Drag de tarjetas (Pointer Events, funciona con mouse y táctil) ---------- */

  function bindCardDrag(cardEl, delBtn, card, col) {
    var pointerId = null;
    var startX = 0,
      startY = 0;
    var dragging = false;
    var ghost = null;
    var ghostOffsetX = 0,
      ghostOffsetY = 0;
    var sourceColId = null;
    var targetColId = null;

    cardEl.addEventListener("pointerdown", function (e) {
      if (e.target === delBtn || delBtn.contains(e.target)) return;
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
        return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      sourceColId = col.id;
      try {
        cardEl.setPointerCapture(pointerId);
      } catch (err) {}
    });

    cardEl.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
          return;
        dragging = true;
        beginDrag(e);
      }
      e.preventDefault();
      moveDrag(e);
    });

    cardEl.addEventListener("pointerup", function (e) {
      if (e.pointerId !== pointerId) return;
      if (dragging) {
        endDrag();
      } else {
        startEdit(cardEl, card, col);
      }
      pointerId = null;
    });

    cardEl.addEventListener("pointercancel", function (e) {
      if (e.pointerId !== pointerId) return;
      if (dragging) cancelDrag();
      pointerId = null;
    });

    function beginDrag(e) {
      var rect = cardEl.getBoundingClientRect();
      ghostOffsetX = e.clientX - rect.left;
      ghostOffsetY = e.clientY - rect.top;

      ghost = cardEl.cloneNode(true);
      ghost.classList.add("card-ghost");
      ghost.classList.remove("card");
      ghost.style.width = rect.width + "px";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      var ghostDel = ghost.querySelector(".card-del");
      if (ghostDel) ghostDel.remove();
      document.body.appendChild(ghost);

      cardEl.classList.add("dragging");
      targetColId = sourceColId;
      startEdgeScrollLoop();
    }

    function moveDrag(e) {
      if (!ghost) return;
      ghost.style.left = e.clientX - ghostOffsetX + "px";
      ghost.style.top = e.clientY - ghostOffsetY + "px";

      updateEdgeScroll(e.clientX);

      var elUnder = document.elementFromPoint(e.clientX, e.clientY);
      var cardsWrap = elUnder ? elUnder.closest(".cards") : null;
      if (!cardsWrap) {
        var colBody = elUnder ? elUnder.closest(".col-body") : null;
        if (colBody) cardsWrap = colBody.querySelector(".cards");
      }
      if (!cardsWrap) return;

      targetColId = cardsWrap.dataset.colId;
      removeAllPlaceholders();
      var placeholder = ensurePlaceholder(cardsWrap);
      var after = getCardAfterY(cardsWrap, e.clientY);
      if (after == null) cardsWrap.appendChild(placeholder);
      else cardsWrap.insertBefore(placeholder, after);
    }

    function endDrag() {
      stopEdgeScrollLoop();
      var placeholder = document.querySelector(".drop-placeholder");
      var targetCol = board.columns.find(function (c) {
        return c.id === targetColId;
      });
      var fromCol = board.columns.find(function (c) {
        return c.id === sourceColId;
      });

      if (placeholder && targetCol && fromCol) {
        var cardsWrap = placeholder.parentElement;
        var index = Array.prototype.indexOf.call(
          cardsWrap.children,
          placeholder,
        );
        var cardObj = fromCol.cards.find(function (c) {
          return c.id === card.id;
        });
        if (cardObj) {
          fromCol.cards = fromCol.cards.filter(function (c) {
            return c.id !== card.id;
          });
          if (fromCol.id === targetCol.id && index > fromCol.cards.length)
            index = fromCol.cards.length;
          targetCol.cards.splice(
            Math.min(index, targetCol.cards.length),
            0,
            cardObj,
          );
          saveBoard();
        }
      }
      cleanupDrag();
      render();
    }

    function cancelDrag() {
      stopEdgeScrollLoop();
      cleanupDrag();
    }

    function cleanupDrag() {
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      cardEl.classList.remove("dragging");
      removeAllPlaceholders();
      dragging = false;
    }
  }

  /* ---------- Drag de columnas (desde el handle) ---------- */

  function bindColumnDrag(handleEl, colId) {
    var pointerId = null;
    var startX = 0,
      startY = 0;
    var dragging = false;
    var ghost = null;
    var ghostOffsetX = 0,
      ghostOffsetY = 0;
    var colEl = null;

    handleEl.addEventListener("pointerdown", function (e) {
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      colEl = handleEl.closest(".column");
      try {
        handleEl.setPointerCapture(pointerId);
      } catch (err) {}
    });

    handleEl.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
          return;
        dragging = true;
        beginDrag(e);
      }
      e.preventDefault();
      moveDrag(e);
    });

    handleEl.addEventListener("pointerup", function (e) {
      if (e.pointerId !== pointerId) return;
      if (dragging) endDrag();
      pointerId = null;
    });

    handleEl.addEventListener("pointercancel", function (e) {
      if (e.pointerId !== pointerId) return;
      if (dragging) cancelDrag();
      pointerId = null;
    });

    function beginDrag(e) {
      var rect = colEl.getBoundingClientRect();
      ghostOffsetX = e.clientX - rect.left;
      ghostOffsetY = e.clientY - rect.top;

      ghost = document.createElement("div");
      ghost.style.position = "fixed";
      ghost.style.zIndex = "999";
      ghost.style.pointerEvents = "none";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      ghost.style.width = rect.width + "px";
      ghost.style.height = Math.min(rect.height, 120) + "px";
      ghost.style.borderRadius = "8px";
      ghost.style.background = "var(--bg-sunk)";
      ghost.style.border = "1px solid var(--line-strong)";
      ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
      ghost.style.opacity = "0.9";
      document.body.appendChild(ghost);

      colEl.classList.add("col-dragging");
      startEdgeScrollLoop();
    }

    function moveDrag(e) {
      if (!ghost) return;
      ghost.style.left = e.clientX - ghostOffsetX + "px";
      ghost.style.top = e.clientY - ghostOffsetY + "px";

      updateEdgeScroll(e.clientX);

      var elUnder = document.elementFromPoint(e.clientX, e.clientY);
      var overCol = elUnder ? elUnder.closest(".column") : null;
      document.querySelectorAll(".column").forEach(function (c) {
        c.classList.remove("drag-over-col");
      });
      if (overCol && overCol !== colEl) {
        overCol.classList.add("drag-over-col");
      }
    }

    function endDrag() {
      stopEdgeScrollLoop();
      var elUnder = ghost
        ? document.elementFromPoint(
            parseFloat(ghost.style.left) + ghostOffsetX,
            parseFloat(ghost.style.top) + ghostOffsetY,
          )
        : null;
      var overCol = elUnder ? elUnder.closest(".column") : null;

      if (overCol && overCol.dataset.colId !== colId) {
        var fromIndex = board.columns.findIndex(function (c) {
          return c.id === colId;
        });
        var toIndex = board.columns.findIndex(function (c) {
          return c.id === overCol.dataset.colId;
        });
        var moved = board.columns.splice(fromIndex, 1)[0];
        board.columns.splice(toIndex, 0, moved);
        saveBoard();
      }
      cleanupDrag();
      render();
    }

    function cancelDrag() {
      stopEdgeScrollLoop();
      cleanupDrag();
    }

    function cleanupDrag() {
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      if (colEl) colEl.classList.remove("col-dragging");
      document.querySelectorAll(".column").forEach(function (c) {
        c.classList.remove("drag-over-col");
      });
      dragging = false;
    }
  }

  render();
})();
