let board = null
let $board = $('#myBoard')
let game = new Chess()
let puzzle  = null
let moves  = null
let orientation = null
// counter for current index in the puzzle solution
let counter = undefined
let promoting = false
let promotingTo = 'q'
let history = []

const moveSound = new Audio('move.mp3')
const captureSound = new Audio('capture.mp3')

// Play the sound for a move. Rewinds first so back-to-back moves each make a sound
// (play() is a no-op on an already-playing element), and ignores autoplay rejections.
function playMoveSound(move) {
    const sound = move.captured ? captureSound : moveSound
    sound.currentTime = 0
    sound.play().catch(() => {})
}
const squareClass = 'square-55d63'
const whiteSquareGrey = '#a9a9a9'
const blackSquareGrey = '#696969'

const $countdownContainer = $('#countdownContainer')
$countdownContainer.hide()
const $countdown = $('#countdown')
const $loading = $('#loading')
const $loadingText = $('#loadingText')
const $promotionDialog = $('#promotion-dialog')
$promotionDialog.hide()
const $memo = $('#memo')
const $theme = $('#theme')
const $rating = $('#rating')
const $easyMode = $('#easyMode')
const $again = $('#again')
const $giveUp = $('#giveUp')
const $retry = $('#retry')
const $next = $('#next')
const $shortcutHint = $('#shortcutHint')
const $left = $('#left')
const $right = $('#right')
const $correct = $('#correct')
const $incorrect = $('#incorrect')
const $pgn = $('#pgn')
const $turnDot = $('#turnDot')
const $turnText = $('#turnText')
const $memoBarContainer = $('#memoBarContainer')
const $memoBar = $('#memoBar')
const getImgSrc = piece => `img/chesspieces/${$theme.val()}/{piece}.png`.replace('{piece}', game.turn() + piece.toLocaleUpperCase())

// Functions for Easy Mode

function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
}

function greySquare(square) {
    let $square = $('#myBoard .square-' + square)

    let background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
    }

    $square.css('background', background)
}

// Handle mouse events with chessboard.js

function onDragStart(source, piece) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop(source, target) {
    removeGreySquares()

    const position = game.fen()
    const piece = game.get(source).type

    // see if the move is legal
    let move = game.move({
        from: source,
        to: target,
        promotion: promotingTo
    })

    // illegal move
    if (move === null) return 'snapback'

    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'pointer')
    const sourceRank = source.charAt(1)
    const targetRank = target.charAt(1)

    if (!promoting && piece === 'p'
        && ((sourceRank === '7' && targetRank === '8') || (sourceRank === '2' && targetRank === '1'))) {
        // undo the last move to allow for piece selection
        game.undo()

        // set the color of pieces in the modal
        $('.promotion-piece-q').attr('src', getImgSrc('q'))
        $('.promotion-piece-r').attr('src', getImgSrc('r'))
        $('.promotion-piece-n').attr('src', getImgSrc('n'))
        $('.promotion-piece-b').attr('src', getImgSrc('b'))
        $promotionDialog.attr('data-source', source)
        $promotionDialog.attr('data-target', target)
        $promotionDialog.show()
        $promotionDialog.position({ of: $board, my: 'center center', at: 'center center' })
        $board.css('pointer-events', 'none')

        promoting = true

        return 'snapback'
    }

    playMoveSound(move)

    // incorrect move, unless it delivers checkmate (any mating move counts, including alternative promotions)
    const wrongMove = !moves[counter].includes(source + target) || (promoting && !moves[counter].endsWith(promotingTo))
    if (wrongMove && !game.in_checkmate()) {
        const movesToNow = game.pgn().split('\n').splice(3)[0]

        // display position after incorrect move
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })

        // revert to position before incorrect move
        board.position(position)
        game.load(position)

        showSolution(movesToNow)

        // update interface
        $again.hide()
        $giveUp.hide()
        $incorrect.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
        $next.show()
        $shortcutHint.show()
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')

        return 'snapback'
    }

    if (move.promotion) onSnapEnd()

    updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
    if (++counter === moves.length) { // puzzle finished
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })
        // update interface
        $again.hide()
        $giveUp.hide()
        $correct.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
        $next.show()
        $shortcutHint.show()
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')

        return
    }

    // make the next move in the puzzle
    const move = game.move(moves[counter++], { sloppy : true })
    playMoveSound(move)

    highlightMove(move)
    board.position(game.fen())
    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'pointer')

    updateStatus()
}

function onMouseoverSquare (square) {
    if ($easyMode.is(':checked') && $giveUp.is(':visible')) {
        // get list of possible moves for this square
        let moves = game.moves({
            square: square,
            verbose: true
        })

        // exit if there are no moves available for this square
        if (moves.length === 0) return

        // highlight the square they moused over
        greySquare(square)

        // highlight the possible squares for this piece
        for (let i = 0; i < moves.length; i++) {
            greySquare(moves[i].to)
        }
    }
}

// Functions for notation below the chess board

function getStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        return prefix + ' ' + status
    } else {
        return game.pgn().split('\n').splice(3)[0]
    }
}

function updateStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        $pgn.html(prefix + ' ' + status)
    } else {
        $pgn.html(game.pgn().split('\n').splice(3)[0])
    }
}

// Parsed puzzle rows, keyed by rating band, so each CSV is only fetched and split once
const puzzleCache = {}

function loadPuzzles(rating) {
    if (puzzleCache[rating]) return Promise.resolve(puzzleCache[rating])

    $loading.show()
    $loadingText.show()
    return $.get('lichess_db_puzzle/' + rating + '.csv').then(csv => {
        puzzleCache[rating] = csv.trimEnd().split('\n')
        return puzzleCache[rating]
    })
}

/**
 * Generate a new puzzle
 * @param {string[]} [p] - puzzle row, if already known
 */

function getPuzzle(p) {
    const ready = p
        ? Promise.resolve(p)
        : loadPuzzles($rating.val()).then(data => data[Math.floor(Math.random() * data.length)].split(','))

    ready.then(row => {
        puzzle = row

        game.load(puzzle[1])
        moves = puzzle[2].split(' ')
        orientation = game.turn() === 'b' ? 'white' : 'black'
        history = []

        // show which side the user is playing
        $turnDot.attr('class', orientation)
        $turnText.text(`Find the best move for ${orientation === 'white' ? 'White' : 'Black'}`)

        $loading.hide()
        $loadingText.hide()

        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: puzzle[1]
        })

        // make first move of the puzzle
        const move = game.move(moves[0], { sloppy: true })
        playMoveSound(move)
        counter = 1

        highlightMove(move)
        board.position(game.fen())

        updateStatus()

        // queue remove pieces after memorization time
        memoTimeout = setTimeout(hidePieces, 1000 * $memo.val())

        $countdownContainer.show()

        // drain the memorization bar over the memorization time
        $memoBarContainer.show()
        $memoBar.css({ transition: 'none', width: '100%' })
        $memoBar[0].offsetWidth // force reflow so the reset width applies before animating
        $memoBar.css({ transition: `width ${$memo.val()}s linear`, width: '0%' })

        // start countdown
        let countdown = $memo.val()
        $countdown.html(countdown)
        countdownInterval = setInterval(() => {
            if (countdown == 1) {
                $countdownContainer.hide()
                clearInterval(countdownInterval)
            }
            $countdown.html(--countdown)
        }, 1000)
    })
}

// Functions for the memorization phase

let memoTimeout = null
let countdownInterval = null

function hidePieces() {
    board = Chessboard('myBoard', {
        ...config,
        orientation,
        draggable: true,
        position: game.fen(),
        pieceTheme: 'img/chesspieces/blindfold.png'
    })
    $(`img[data-piece^=${game.turn()}]`).css('cursor', 'pointer')
    $easyMode.attr('disabled', true)
    $again.show()
    $giveUp.show()
    $memoBarContainer.hide()
}

// Let the user end memorization early by tapping the countdown or pressing Space
function skipMemorization() {
    if ($countdownContainer.is(':hidden')) return
    clearTimeout(memoTimeout)
    clearInterval(countdownInterval)
    $countdownContainer.hide()
    hidePieces()
}

$countdownContainer.click(skipMemorization)

// Functions for showing sequence of moves in puzzle solution

let timeouts = []

function showSolution(movesToNow) {
    if (movesToNow) {
        movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
        if (movesToNow.endsWith('.')) movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
    }
    for (let i = counter; i < moves.length; i++) {
        timeouts[i] = setTimeout(() => {
            const move = game.move(moves[i], { sloppy : true })
            board.position(game.fen())
            playMoveSound(move)
            updateStatus(movesToNow)
        }, (i - counter + 1) * 1000)
    }
    timeouts.push(setTimeout(() => {
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')
    }, (moves.length - counter) * 1000))
}

function clearTimeouts() {
    for (let i = counter; i < timeouts.length; i++)
        clearTimeout(timeouts[i])
}

function highlightMove(move) {
    $board.find('.' + squareClass).removeClass('highlight-black')
    $board.find('.square-' + move.from).addClass('highlight-black')
    $board.find('.square-' + move.to).addClass('highlight-black')
}

// Configuration for Chessboard

const config = {
    onDragStart,
    onDrop,
    onSnapEnd,
    onMouseoutSquare: removeGreySquares,
    onMouseoverSquare
}

// Prevent page scrolling when dragging pieces on mobile

$board.on('scroll touchmove touchend touchstart contextmenu', event => event.preventDefault())

// Keep the board fitted to its container when the window is resized

$(window).on('resize', () => board?.resize())

// Persist memorization time by binding to local storage

const memo = localStorage.getItem('memo')
if (memo)
    $memo.val(memo)
else
    $memo.val(5)
$memo.on('input', () => {
    localStorage.setItem('memo', $memo.val())
})

$('#promote-to li').click(function() {
    $promotionDialog.hide()
    promotingTo = $(this).find('span').text()
    $board.css('pointer-events', 'auto')
    onDrop($promotionDialog.attr('data-source'),$promotionDialog.attr('data-target'))
    promoting = false
})

// Set initial piece theme, and persist by binding to local storage

const theme = localStorage.getItem('theme')
if (theme) {
    $theme.val(theme)
    config.pieceTheme = `img/chesspieces/${theme}/{piece}.png`
} else {
    $theme.val('wikipedia')
    config.pieceTheme = `img/chesspieces/wikipedia/{piece}.png`
}
$theme.on('change', () => {
    config.pieceTheme = `img/chesspieces/${$theme.val()}/{piece}.png`
    if ($giveUp.is(':hidden') || $next.is(':visible')) {
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: board.fen(),
            pieceTheme: `img/chesspieces/${$theme.val()}/{piece}.png`
        })
    }
    $('.promotion-piece-q').attr('src', getImgSrc('q'))
    $('.promotion-piece-r').attr('src', getImgSrc('r'))
    $('.promotion-piece-n').attr('src', getImgSrc('n'))
    $('.promotion-piece-b').attr('src', getImgSrc('b'))
    localStorage.setItem('theme', $theme.val())
})

// Persist puzzle rating by binding to local storage

const rating = localStorage.getItem('rating')
if (rating) {
    $rating.val(rating)
} else {
    $rating.val('1400-1599')
}
$rating.on('change', () => {
    localStorage.setItem('rating', $rating.val())
})

// Button Functionality

$again.hide()
$again.click(() => {
    clearTimeouts()
    getPuzzle(puzzle)
    $again.hide()
    $giveUp.hide()
    $correct.hide()
    $incorrect.hide()
})


$giveUp.hide()
$giveUp.click(() => {
    board = Chessboard('myBoard', {
        ...config,
        orientation,
        draggable: false,
        position: game.fen()
    })
    showSolution()
    $again.hide()
    $giveUp.hide()
    $retry.show()
    $easyMode.attr('disabled', false)
    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
    $next.show()
    $shortcutHint.show()
})

$retry.hide()
$retry.click(() => {
    clearTimeouts()
    getPuzzle(puzzle)
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
    $shortcutHint.hide()
    $left.css('visibility', 'hidden')
    $right.css('visibility', 'hidden')
})

$next.hide()

$shortcutHint.hide()
$next.click(() => {
    clearTimeouts()
    getPuzzle()
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
    $shortcutHint.hide()
    $left.css('visibility', 'hidden')
    $right.css('visibility', 'hidden')
})

$left.css('visibility', 'hidden')
$right.css('visibility', 'hidden')

// Hide info display

$correct.hide()
$incorrect.hide()

// Allow toggling back and forth between moves after puzzle ended using arrow keys

$(document).keydown(function (e) {
    // ignore keys used to operate form controls (and let focused buttons handle Enter/Space natively)
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT') return
    if (tag === 'BUTTON' && (e.keyCode === 13 || e.keyCode === 32)) return

    // Space/Enter during memorization hides the pieces early
    if ($countdownContainer.is(':visible') && (e.keyCode === 13 || e.keyCode === 32)) {
        e.preventDefault()
        skipMemorization()
        return
    }

    // shortcuts once the puzzle has ended: Enter/Space for next, R for retry
    if ($next.is(':visible')) {
        if (e.keyCode === 13 || e.keyCode === 32) {
            e.preventDefault()
            $next.click()
            return
        }
        if (e.keyCode === 82) {
            $retry.click()
            return
        }
    }

    const move = game.undo()
    if (move) game.move(move)

    if (history.length === 0 && (!move || move.from + move.to + (move.promotion ?? '') !== moves[moves.length - 1])) return

    if (e.keyCode === 37) {
        const m1 = game.undo()
        const m2 = game.undo()
        if (!m2) {
            if (m1) game.move(m1)
            return
        }
        game.move(m2)
        history.push(m1)
        board.position(game.fen())
    } else if (e.keyCode === 39) {
        if (history.length === 0) return
        game.move(history.pop())
        board.position(game.fen())
    } else {
        return
    }
    let html = $pgn.html().replaceAll('<strong>', '')
    html = html.replaceAll('</strong>', '')
    // the displayed pgn may have its leading move number trimmed (status shown with a prefix)
    let status = getStatus()
    if (!html.includes(status)) {
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
    }
    const end = html.split(status)[1] ?? ''
    const start = html.slice(0, html.length - end.length)
    const past = start.split(' ')
    const bold = past[past.length - 1]
    if (bold.trim().length === 0) {
        let all = html.split(' ')
        const last = all.pop()
        $pgn.html(all.join(' ') + ' <strong>' + last + '</strong>')
        return
    }
    $pgn.html(start.slice(0, -bold.length) + '<strong>' + bold + '</strong>' + end)
})

// Initial call

getPuzzle()