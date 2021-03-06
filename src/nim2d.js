'use strict'; // This code won't work for IE 11 due to for...of loops
var style = window.getComputedStyle(document.documentElement);
let colors = {
	"selectborder": style.getPropertyValue('--select-border'),
	"blocktext": style.getPropertyValue('--block-text'),
	"selected": style.getPropertyValue('--selected'),
	"normal": style.getPropertyValue('--normal')
}
let mousedown = false, move = 2, startX, startY, endX, endY, timer,
	animation = false, filledX = [], filledY = [];
const t = c.getContext('2d'), l = 650, sidelength = 100, half = sidelength / 2,
	arr = new Array(6), history = [], rollback = [], AABB = (x, y) => // axis-aligned bounding box check
		x < Math.max(startX, endX) && x + half > Math.min(startX, endX) &&
		y < Math.max(startY, endY) && y + half > Math.min(startY, endY),
	equal = (a, b) => a >= b && b >= a, // check if 2 arrays are equal (actually works, magic)
	sum = arr => arr.reduce((a, b) => a + b, 0),
	sumAll = arr => arr.reduce((a, b) => a + sum(b), 0), // unused...
	stats = arr => { // also unused, this might be helpful to further board analysis
		let temp = 0, totalI = 0, totalJ = 0;
		for(let i = arr.length; i--;) {
			for(let j = arr[0].length; j--;)
				temp += arr[i][j];
			totalI += temp * (temp - 1) / 2;
			temp = 0;
		}
		for(let i = arr.length; i--;) {
			for(let j = arr[0].length; j--;)
				temp += arr[j][i];
			totalJ += temp * (temp - 1) / 2;
			temp = 0;
		} // lol didn't even finish; no return statement.
	},
	shrink = arr => {
		filledX.length = filledY.length = 0;
		// filter empty rows and copy each row that is not empty (works, don't touch)
		const narr = arr.filter((x, i) => sum(x) && filledX.push(i)).map(x => x.slice());
		if(!narr.length) return narr;
		for(let j = narr[0].length; j--;) {
			let filled = false;
			for(const row of narr) {
				if(row[j]) {
					filled = true;
					filledY.unshift(j);
					break;
				}
			}
			if(!filled)
				for(const row of narr) // where are the brackets, you ask?
					row.splice(j, 1); // I ate them for breakfast.
		}
		return narr;
	},
	time = (fn, arg1, arg2) => { // To time how long the AI takes, run: time(AI, arr, 441)
		const now = performance.now();
		fn(arg1, arg2);
		console.log(performance.now() - now);
	},
	posToInt = arr => { // converts board position to integer for dictionary lookup
		let k = 0;
		for(const row of arr)
			for(const cell of row)
				k = k * 2 + cell;
		return k;
	},
	positions = [], // entries point to coordinates of next move
	losingPositions = [], // entries are boolean values
	evaluation = {
		'Empty': 7, // empty = already won = best
		'1x1': 6, // can leave opponent with 1x1
		'2x2': 5, // can leave opponent with 2x2
		'Dictionary': 4, // dictionary needs to identify winning vs losing move...
		'Search': 3, // Unused, maybe use this for deeper search?
		'Random': 3, // Most AI moves actually return this
		'Dictionary, losing': 2, // AI needs to know if a position is bad for opponent
		'2x2, losing': 1, // is left with 2x2
		'1x1, losing': 0, // is left with 1x1
	},
	randomXY = () => {
		const pos = [];
		for(let i = 6; i--;)
			for(let j = 6; j--;)
				if(arr[i][j]) pos.push([i, j]);
		return pos[Math.random() * pos.length | 0];
	}, // BEGIN AI CODE, good luck.
	AIoutput = (x0, y0, x1, y1, int = 0, method = 'Unknown', display = 0) => {
		if(x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) {
			[x0, y0] = [x1, y1] = randomXY();
			method += ', losing';
		} else if(method == '1x1' || method == '2x2') {
			let count = 0;
			for(let x = x0; x <= x1; x++) {
				for(let y = y0; y <= y1; y++) {
					if(arr[x][y]) {
						count++;
						break;
					}
				}
			}
			if(!count) {
				[x0, y0] = [x1, y1] = randomXY();
				method += ', losing';
			}
		} else if(losingPositions.includes(int)) method = 'Dictionary, losing';
		if(display) {
			AIdialog(`AI${1 + (move & 1)}: (${x0}, ${y0}), (${x1}, ${y1})`)
			console.log({
				"posToInt": int,
				"filledX": filledX,
				"filledY": filledY,
				"method": method
			})
		}
		if(method[0] == 'S') return method.slice(0, 6); // 'Search'
		return method;
	},
	AI = (arr, breadth = 0) => { // literally a bunch of if statements...
		// BEGIN STRUCTURAL ANALYSIS
		const shrunk = shrink(arr);
		if(!shrunk.length) return 'Empty';
		const maxX = shrunk.length - 1, left = shrunk[0], right = shrunk[maxX],
			top = [], bottom = [], maxY = left.length - 1, top2 = [], bottom2 = [],
			posIndex = posToInt(shrunk);
		let x0 = 0, y0 = 0, x1 = 5, y1 = 5;
		for(const row of shrunk) { // save horizontal rows for later calculations
			top.push(row[0]);
			if(maxY) { // necessary check because row might have only 1 cell, maxY = 0
				top2.push(row[1]); // but doesn't matter if top2 == bottom2
				bottom2.push(row[maxY - 1]);
			}
			bottom.push(row[maxY]);
		}
		const sums = [sum(left), sum(right), sum(top), sum(bottom)]; // get sum of border rows
		if(sums.includes(1)) { // Winning position! Unless this is the only piece left...
			if(sums[0] == 1) // In that case, AIoutput() will fix this mistake. (e.g. x0 = undefined)
				x0 = filledX[1];
			else if(sums[1] == 1)
				x1 = filledX[maxX - 1];
			else if(sums[2] == 1)
				y0 = filledY[1];
			else// if(sums[3] == 1) // implied
				y1 = filledY[maxY - 1];
			return AIoutput(x0, y0, x1, y1, posIndex, '1x1', breadth);
		}
		if(sums[0] == 2) {
			if(equal(left, right)) { // Are the leftmost and rightmost columns exactly the same with 2 pieces?
				x0 = filledX[1];
				x1 = filledX[maxX - 1];
				return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
			}
			if(equal(left, shrunk[1])) { // Are the 2 leftmost columns exactly the same with 2 pieces?
				x0 = filledX[2];
				return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
			}
		}
		if(sums[2] == 2) {
			if(equal(top, bottom)) { // Are the top and bottom rows exactly the same with 2 pieces?
				y0 = filledY[1];
				y1 = filledY[maxY - 1];
				return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
			}
			if(equal(top, top2)) { // Are the 2 highest rows exactly the same with 2 pieces?
				y0 = filledY[2];
				return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
			}
		}
		if(sums[1] == 2 && equal(right, shrunk[maxX - 1])) { // Are the 2 rightmost columns exactly the same with 2 pieces?
			x1 = filledX[maxX - 2];
			return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
		}
		if(sums[3] == 2 && equal(bottom, bottom2)) { // Are the 2 lowest rows exactly the same with 2 pieces?
			y1 = filledY[maxY - 2];
			return AIoutput(x0, y0, x1, y1, posIndex, '2x2', breadth);
		} // END STRUCTURAL ANALYSIS
		const AImove = positions[posIndex];
		if(!AImove) { // Unknown position? Make random move.
			if(!breadth) { // If not searching recursively, just return random.
				[x0, y0] = randomXY();
				return AIoutput(x0, y0, x0, y0, posIndex, 'Random', breadth);
			} // BEGIN RANDOM SEARCH
			// # of moves = maxX(maxX + 1) * maxY(maxY + 1) / 4. For 6x6 this is maximum 441 options.
			const possibleMoves = []; // @ x = 4, y = 4, l = 100
			let bestMove = [0, 0, 5, 5, 'Empty'];
			for(const rx1 of filledX)
				for(const ry1 of filledY)
					for(const rx0 of filledX)
						for(const ry0 of filledY)
							// if(rx1 >= rx0 && ry1 >= ry0) // Note: some empty squares are included.
							// if(arr[rx1][ry1] && arr[rx0][ry0] && rx1 >= rx0 && ry1 >= ry0)
							// however, some moves will require a coordinate to be on an empty square
							// It may even be the winning move, although this happens rarely.
							// the following criteria is a compromise between check speed and validity
							// it checks for 1x1 squares that are empty and excludes them.
							if(rx1 >= rx0 && ry1 >= ry0 && (rx1 != rx0 || ry1 != ry0 || arr[rx0][ry0]))
								possibleMoves.push([rx0, ry0, rx1, ry1]); // Rip
			for(let i = Math.min(breadth, possibleMoves.length); i--;) {
				const narr = arr.map(x => x.slice()), // clones arr
					[rx0, ry0, rx1, ry1] = possibleMoves.splice(Math.random() * possibleMoves.length | 0, 1)[0];
				let count = 0;
				for(let x = rx0; x <= rx1; x++)
					for(let y = ry0; y <= ry1; y++) {
						if(narr[x][y]) count++;
						narr[x][y] = false;
					}
				if(!count) continue; // this is still necessary because sometimes r1 != r0 and the region is still empty
				const thisEvaluation = AI(narr);
				if(evaluation[thisEvaluation] < evaluation[bestMove[4]])
					bestMove = [rx0, ry0, rx1, ry1, thisEvaluation];
			}
			[x0, y0, x1, y1] = bestMove;
			return AIoutput(x0, y0, x1, y1, posIndex, `Search${breadth}:${bestMove[4]}`, breadth); // END RANDOM SEARCH
		}// BEGIN DICTIONARY SEARCH
		if(AImove.length == 4) // normalize data structure
			[x0, y0, x1, y1] = AImove;
		else [x0, y0] = [x1, y1] = AImove; // Assumption: x1 >= x0, y1 >= y0
		if(filledY.length > filledX.length) [x0, y0, x1, y1] = [y0, x0, y1, x1];
		return AIoutput(filledX[x0], filledY[y0], filledX[x1], filledY[y1], posIndex, 'Dictonary', breadth); // END DICTIONARY SEARCH
	},
	turn = () => {
		//setTimeout(cancelAnimationFrame, 16, timer);
		mousedown = false;
		const removed = [];
		for(let i = 6; i--;) {
			for(let j = 6; j--;) {
				if(!arr[i][j]) continue;
				const x = i * sidelength + half, y = j * sidelength + half;
				if(AABB(x, y)) {
					arr[i][j] = false;
					removed.push(i, j);
				}
			}
		}
		if(removed.length) {
			move++;
			history.push(removed);
			rollback.length = 0;
		}
		if(arr.every(e => e.every(f => !f))) {
			//cancelAnimationFrame(timer);
			arr.forEach(e => e.fill(true));
			history.length = rollback.length = 0;
			dialog(`Player ${1 + (move & 1)} won in ${move >>> 1} moves!`);
			move = 2;
		}
		if((!(move & 1) && p1ai.checked) || ((move & 1) && p2ai.checked))
			AI(arr, +searchBreadth.value);
		else AIdialog();
		//setTimeout(cancelAnimationFrame, 16, timer);
	};
// Note: some winning position indices are the same if you rotate it 90 degrees...
// This is fixed by swapping x and y if there are more empty X columns than empty Y rows.
// Winning:
	// 3x3 is all covered by using losingPositions[].
	// It's better to use losingPositions because it takes less space.
	// 3x4
//positions[4095] = [1, 0, 2, 0];
positions[4007] = [4, 3];
positions[3895] = [0, 3];
positions[4021] = [1, 1, 1, 2];
positions[2495] = [3, 2]; // <-- could be problematic; need checks
positions[2366] = [2, 1, 2, 2]; // same here
positions[3807] = [1, 1];
positions[2654] = [2, 1, 2, 2];
positions[3791] = [0, 2];
positions[3277] = [1, 1, 1, 2];
positions[3743] = [0, 1, 1, 1];
positions[3295] = [2, 1];
positions[3806] = [1, 1];
/*//losing
positions[2559] = [1, 1];
positions[2494] = [0, 1]; // same here
positions[3679] = [3, 2];
positions[3279] = [3, 1];*/

losingPositions.push(355, 334, 397, 229); // 3x3 5 pieces
losingPositions.push(238, 427); // 3x3 6 pieces
losingPositions.push(375, 351, 477, 501);
losingPositions.push(495, 255, 447, 507, 510); // 3x3 8 pieces

losingPositions.push(4023, 3807, 2559, 4089); // 3x4 10 pieces

losingPositions.push(12684, 51219, 41349, 22554); // 4x4 6 pieces
losingPositions.push(47133); // 4x4 8 pieces
// TODO: add ALL losing positions (there are at least 2**35 of them on a 6x6 board...)
for(let i = 6; i--;)
	arr[i] = new Array(6).fill(true);
t.strokeStyle = colors.selectborder;
t.font = '24px Arial';
t.lineWidth = 2;
// GUI events
c.addEventListener('mousedown', e => {
	if(!animation) {
		startX = endX = e.offsetX;
		startY = endY = e.offsetY;
		mousedown = true;
	}
	//draw();
});
c.addEventListener('mousemove', e => {
	if(mousedown && !animation) {
		endX = e.clientX;
		endY = e.clientY;
	}
});
c.addEventListener('mouseup', e => { if(mousedown) turn(); });
c.addEventListener('mouseout', e => mousedown = false);
// not working:
//p1ai.addEventListener('change', e => { if(p1ai.checked && !(move & 1)) AI(arr, +searchBreadth); });
//p2ai.addEventListener('change', e => { if(p2ai.checked && move & 1) AI(arr, +searchBreadth); });
function draw() {
	t.clearRect(0, 0, l, l);
	t.fillStyle = '#fff';
	t.fillText(`Player ${1 + (move & 1)}, move ${move >>> 1}`, 4, 20);
	for(let i = 6; i--;) {
		for(let j = 6; j--;) {
			const x = i * sidelength + half,
				  y = j * sidelength + half;
			if(arr[i][j]) {
				if(mousedown && AABB(x, y)) t.fillStyle = colors.selected;
				else t.fillStyle = colors.normal;
				t.fillRect(x, y, half, half);
			}
			t.fillStyle = colors.blocktext;
			t.fillText(i + ', ' + j, x + 5, y + 32);
		}
	}
	if(mousedown) {
		t.strokeRect(Math.min(startX, endX), Math.min(startY, endY),
		Math.abs(startX - endX), Math.abs(startY - endY));
	}
	timer = requestAnimationFrame(draw);
}
function dialog(message, callback) {
	// Construct the div that covers the whole page
	let overlay = document.createElement("div")
		overlay.setAttribute("id", "overlay")

	let dialog = document.createElement("div")
		dialog.setAttribute("class", "dialog")
		dialog.setAttribute("onclick", "")

	// Close button
	let close = document.createElement("span")
		close.setAttribute("class", "close")
		close.setAttribute("href", "#")
		close.innerHTML = '❌'
		close.onclick = function() {
			rmDialog();
		}

	dialog.appendChild(close)

	// Text inside
	let text = document.createElement("p")
		text.setAttribute("class", "dialog text")
		text.innerText = message

	if (callback) {
		let ok = document.createElement("span")
			ok.setAttribute("class", "ok")
			ok.innerHTML = '✅'
			ok.setAttribute("href", "#")
			ok.onclick = function() {
				callback();
				rmDialog();
			}

		dialog.appendChild(ok)
	}

	dialog.appendChild(text)

	overlay.appendChild(dialog)
	// Show dialog
	document.body.appendChild(overlay)
}
function rmDialog() {
	var overlay = document.getElementById("overlay");
	try {
		document.body.removeChild(overlay);
	} catch(e) {}
}
function AIdialog(input) {
	if (input) {
		document.getElementById("info").innerText = input
		document.getElementById("info").style.visibility = "visible"
	} else {
		//document.getElementById("info").innerText = ""
		document.getElementById("info").style.visibility = "hidden"
	}
}
document.addEventListener('keydown', e => {
	switch(e.keyCode) {
		case 82: // 'R' resets the game upon confirming
			if(e.ctrlKey) return;
			if(move) {
				dialog('Are you sure to restart the game?', function() {
					arr.forEach(e => e.fill(true));
					history.length = rollback.length = 0;
					move = 2;
				})
			}
			break;
		case 90: // 'Z' undoes last moves
			if(!history.length) return;
			move--;
			var h = history.pop();
			for(let i = 0; i < h.length; i += 2)
				arr[h[i]][h[i + 1]] = true;
			rollback.push(h);
			break;
		case 89: // 'Y' redoes last moves
			if(!rollback.length) return;
			move++;
			h = rollback.pop();
			for(let i = 0; i < h.length; i += 2)
				arr[h[i]][h[i + 1]] = false;
			history.push(h);
			break;
	}
	if(!(move & 1) && p1ai.checked) AI(arr, +searchBreadth); // are these just not working
	else if((move & 1) && p2ai.checked) AI(arr, +searchBreadth); // FIXME: AI doesn't update automatically
	else AIdialog();
});
timer = requestAnimationFrame(draw);
//cancelAnimationFrame(timer);