const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ============ 游戏数据 ============
const PHASES = ['原材料', '制造', '运输', '使用', '废弃'];

const CARDS = {
  '原材料': [
    { id: 'yuanmian', name: '原生棉花', desc: '种新的棉花', smoke: 3, leaf: 0, tip: '种新棉花要施肥浇水，会产生很多污染哦' },
    { id: 'youjimian', name: '有机棉花', desc: '不施肥的棉花', smoke: 2, leaf: 1, tip: '不用化肥，就没有污染啦，还能保护环境' },
    { id: 'bendimian', name: '本地棉花', desc: '家门口的棉花', smoke: 1, leaf: 0, tip: '不用从很远的地方运过来，就没有运输的污染' },
    { id: 'huishoumian', name: '回收棉花', desc: '旧衣服改的棉花', smoke: 1, leaf: 1, tip: '旧衣服回收再用，就不用种新的棉花啦！' },
  ],
  '制造': [
    { id: 'meidian', name: '煤电工厂', desc: '烧煤的工厂', smoke: 5, leaf: 0, tip: '烧煤会冒很多黑烟，污染最大啦' },
    { id: 'tianranqi', name: '天然气工厂', desc: '烧气的工厂', smoke: 3, leaf: 0, tip: '比烧煤好一点，但是还是有污染' },
    { id: 'fengdian', name: '风电工厂', desc: '用风发电的工厂', smoke: 1, leaf: 2, tip: '风是干净的能源，不会冒黑烟哦！' },
    { id: 'taiyangneng', name: '太阳能工厂', desc: '用太阳发电的工厂', smoke: 1, leaf: 2, tip: '太阳也是干净的能源，超级环保！' },
  ],
  '运输': [
    { id: 'kache', name: '卡车运输', desc: '大卡车运货', smoke: 4, leaf: 0, tip: '卡车要烧很多油，冒很多烟' },
    { id: 'huoche', name: '火车运输', desc: '火车运货', smoke: 2, leaf: 0, tip: '火车一次能运很多东西，污染就小啦' },
    { id: 'haiyun', name: '海运运输', desc: '大船运货', smoke: 1, leaf: 0, tip: '大船运的更多，污染最小！' },
    { id: 'bendishengchan', name: '本地生产', desc: '工厂就在小镇', smoke: 0, leaf: 1, tip: '不用运！一点污染都没有！' },
  ],
  '使用': [
    { id: 'pinfan', name: '频繁更换', desc: '用半年就扔', smoke: 3, leaf: 0, tip: '用没多久就扔，就要做新的，污染就多啦' },
    { id: 'zhengchang', name: '正常使用', desc: '用2年再扔', smoke: 1, leaf: 0, tip: '好好用，用久一点，就不用做新的啦' },
    { id: 'bujiang', name: '修补翻新', desc: '旧了补一补', smoke: 0, leaf: 2, tip: '旧了补补继续用，就不用买新的啦！' },
    { id: 'gongxiang', name: '共享使用', desc: '和朋友一起用', smoke: 0, leaf: 1, tip: '大家一起用，就不用每个人都买新的啦' },
  ],
  '废弃': [
    { id: 'tianmai', name: '直接填埋', desc: '扔去垃圾场', smoke: 4, leaf: 0, tip: '埋掉的垃圾会产生很多臭臭的气体，污染空气' },
    { id: 'fenhao', name: '焚烧发电', desc: '烧了发电', smoke: 2, leaf: 0, tip: '烧了能发电，但是还是有一点烟' },
    { id: 'huishou', name: '材料回收', desc: '拆了重新用', smoke: 0, leaf: 2, tip: '把旧东西拆了，做成新的东西，就不用新的材料啦！' },
    { id: 'juanzeng', name: '捐赠二手', desc: '送给别人用', smoke: 0, leaf: 3, tip: '送给别人，就能继续用，一点污染都没有！' },
  ],
};

const EVENT_CARDS = [
  { id: 'fengdian', name: '风电大丰收', desc: '制造阶段的风电卡多1张！', effect: { phase: '制造', card: 'fengdian', extra: 1 } },
  { id: 'bendimian', name: '本地大丰收', desc: '原材料阶段的本地棉花卡多1张！', effect: { phase: '原材料', card: 'bendimian', extra: 1 } },
  { id: 'youjia', name: '油价上涨', desc: '运输阶段选卡车的小朋友，要多拿1个黑烟球！', effect: { phase: '运输', card: 'kache', extra: 1 } },
  { id: 'huishou', name: '回收政策', desc: '废弃阶段的回收卡多1张！', effect: { phase: '废弃', card: 'huishou', extra: 1 } },
];

const PIECES = [
  { id: 'tshirt', name: '小T恤', color: '#FF9EC4' },
  { id: 'apple', name: '小苹果', color: '#FF6B6B' },
  { id: 'car', name: '小玩具车', color: '#74C0FC' },
  { id: 'phone', name: '小手机', color: '#FFE066' },
];

// ============ 游戏状态 ============
const rooms = new Map();
const shortCodeToRoomId = new Map();

// 生成6位短房间码
function generateShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(roomId, shortCode) {
  return {
    id: roomId,
    shortCode: shortCode,
    players: [], // { socketId, name, piece, smoke, leaf, selectedCard, choices: [], order }
    host: null,
    phase: 0, // 0-4 对应5个阶段
    phaseState: 'waiting', // waiting | selecting | revealing | cleanup | finished
    turnIndex: 0, // 当前选卡顺序索引
    turnQueue: [], // 选卡顺序
    currentCards: [], // 当前阶段展示的卡
    eventCard: null,
    extraCard: null, // 事件卡额外奖励的卡
    playerOrder: [], // 最终排名
    usedPieces: [],
    usedNames: [],
  };
}

function getRoomState(room) {
  return {
    id: room.id,
    shortCode: room.shortCode,
    phase: room.phase,
    phaseName: PHASES[room.phase],
    phaseState: room.phaseState,
    turnIndex: room.turnIndex,
    players: room.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      piece: p.piece,
      smoke: p.smoke,
      leaf: p.leaf,
      selectedCard: p.selectedCard,
      finalSmoke: p.smoke - p.leaf,
      choices: p.choices,
    })),
    eventCard: room.eventCard,
    currentCards: room.currentCards,
    extraCard: room.extraCard,
    host: room.host,
  };
}

function getAvailablePieces() {
  return PIECES.filter(p => !this.usedPieces.includes(p.id));
}

// ============ Socket.IO 处理 ============
io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id);
  let currentRoom = null;

  // 创建房间
  socket.on('createRoom', (userName, callback) => {
    // 生成唯一短码
    let shortCode;
    do {
      shortCode = generateShortCode();
    } while (shortCodeToRoomId.has(shortCode));
    
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const room = createRoom(roomId, shortCode);
    shortCodeToRoomId.set(shortCode, roomId);
    const piece = PIECES[0];
    
    room.host = socket.id;
    room.players.push({
      socketId: socket.id,
      name: userName,
      piece: piece,
      smoke: 0,
      leaf: 0,
      selectedCard: null,
      choices: [],
    });
    room.usedPieces.push(piece.id);
    room.usedNames.push(userName);
    
    rooms.set(roomId, room);
    currentRoom = roomId;
    socket.join(roomId);
    
    callback({ success: true, roomId, shortCode, room: getRoomState(room), pieces: PIECES, allPieces: PIECES });
  });

  // 加入房间（支持短码）
  socket.on('joinRoom', (roomIdOrCode, userName, callback) => {
    // 如果是短码，转为完整房间ID
    let roomId = roomIdOrCode;
    if (!rooms.has(roomIdOrCode) && shortCodeToRoomId.has(roomIdOrCode.toUpperCase())) {
      roomId = shortCodeToRoomId.get(roomIdOrCode.toUpperCase());
    }
    
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: '房间不存在' });
      return;
    }
    if (room.phaseState !== 'waiting') {
      callback({ success: false, error: '游戏已经开始，无法加入' });
      return;
    }
    if (room.players.length >= 4) {
      callback({ success: false, error: '房间已满（最多4人）' });
      return;
    }
    if (room.usedNames.includes(userName)) {
      callback({ success: false, error: '这个名字已经被用了，换一个吧！' });
      return;
    }

    const availablePieces = PIECES.filter(p => !room.usedPieces.includes(p.id));
    if (availablePieces.length === 0) {
      callback({ success: false, error: '没有可选的角色了' });
      return;
    }

    const piece = availablePieces[0];
    room.players.push({
      socketId: socket.id,
      name: userName,
      piece: piece,
      smoke: 0,
      leaf: 0,
      selectedCard: null,
      choices: [],
    });
    room.usedPieces.push(piece.id);
    room.usedNames.push(userName);
    currentRoom = roomId;
    socket.join(roomId);

    callback({ success: true, room: getRoomState(room), pieces: availablePieces });
    io.to(roomId).emit('playerJoined', getRoomState(room));
  });

  // 选择角色
  socket.on('selectPiece', (pieceId, callback) => {
    const room = rooms.get(currentRoom);
    if (!room) { callback({ success: false }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) { callback({ success: false }); return; }
    if (room.usedPieces.includes(pieceId)) { callback({ success: false, error: '这个角色已经被选了' }); return; }

    // 移除旧角色
    room.usedPieces = room.usedPieces.filter(id => id !== player.piece.id);
    // 选新角色
    const newPiece = PIECES.find(p => p.id === pieceId);
    player.piece = newPiece;
    room.usedPieces.push(pieceId);

    const availablePieces = PIECES.filter(p => !room.usedPieces.includes(p.id));
    callback({ success: true, room: getRoomState(room), pieces: availablePieces });
    io.to(currentRoom).emit('roomUpdated', getRoomState(room));
  });

  // 准备开始
  socket.on('startGame', (callback) => {
    const room = rooms.get(currentRoom);
    if (!room) { callback({ success: false }); return; }
    if (room.host !== socket.id) { callback({ success: false, error: '只有房主可以开始游戏' }); return; }
    if (room.players.length < 2) { callback({ success: false, error: '至少需要2个玩家才能开始' }); return; }

    // 随机事件卡
    room.eventCard = EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)];
    // 开始第一阶段
    startPhase(room);
    
    callback({ success: true, room: getRoomState(room) });
    io.to(currentRoom).emit('gameStarted', getRoomState(room));
  });

  function startPhase(room) {
    room.phaseState = 'selecting';
    room.turnIndex = 0;
    room.currentCards = [...CARDS[PHASES[room.phase]]];
    
    // 如果有事件卡效果，增加对应卡
    if (room.eventCard && room.eventCard.effect.phase === PHASES[room.phase]) {
      const extraCard = CARDS[PHASES[room.phase]].find(c => c.id === room.eventCard.effect.card);
      if (extraCard) {
        room.extraCard = { ...extraCard, id: extraCard.id + '_extra' };
        room.currentCards.push(room.extraCard);
      }
    }

    // 随机选卡顺序
    const indices = room.players.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    room.turnQueue = indices;
    
    // 重置玩家选卡状态
    room.players.forEach(p => p.selectedCard = null);

    io.to(room.id).emit('phaseStarted', getRoomState(room));
  }

  // 选卡
  socket.on('selectCard', (cardId, callback) => {
    const room = rooms.get(currentRoom);
    if (!room) { callback({ success: false, error: '房间不存在' }); return; }
    if (room.phaseState !== 'selecting') { callback({ success: false, error: '当前不是选卡阶段' }); return; }

    const currentPlayerIndex = room.turnQueue[room.turnIndex];
    const currentPlayer = room.players[currentPlayerIndex];
    if (currentPlayer.socketId !== socket.id) {
      callback({ success: false, error: '还没轮到你选卡哦！' });
      return;
    }
    if (currentPlayer.selectedCard) {
      callback({ success: false, error: '你已经选过卡了' });
      return;
    }

    const card = room.currentCards.find(c => c.id === cardId);
    if (!card) { callback({ success: false, error: '这张卡不存在' }); return; }

    // 如果是额外卡，应用额外效果
    let actualCard = card;
    if (cardId.endsWith('_extra')) {
      actualCard = { ...card, smoke: card.smoke, leaf: card.leaf + 1 };
    }

    currentPlayer.selectedCard = actualCard;
    currentPlayer.smoke += actualCard.smoke;
    currentPlayer.leaf += actualCard.leaf;
    currentPlayer.choices.push({ phase: PHASES[room.phase], card: actualCard });

    // 标记卡为已选
    const cardIndex = room.currentCards.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      room.currentCards[cardIndex].taken = true;
      room.currentCards[cardIndex].takenBy = currentPlayer.name;
    }

    room.turnIndex++;
    io.to(room.id).emit('cardSelected', { 
      playerId: socket.id, 
      cardId, 
      playerName: currentPlayer.name,
      room: getRoomState(room) 
    });

    // 检查是否所有人都选完了
    if (room.turnIndex >= room.players.length) {
      room.phaseState = 'revealing';
      io.to(room.id).emit('allSelected', getRoomState(room));
    }

    callback({ success: true, room: getRoomState(room) });
  });

  // 使用绿叶币清洗黑烟
  socket.on('useLeaf', (targetPlayerName, leafCount, callback) => {
    const room = rooms.get(currentRoom);
    if (!room) { callback({ success: false }); return; }
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) { callback({ success: false }); return; }
    if (leafCount > player.leaf) { callback({ success: false, error: '绿叶币不够' }); return; }

    player.leaf -= leafCount;
    if (targetPlayerName === 'self') {
      // 洗自己的黑烟
      const cleanAmount = Math.min(leafCount, player.smoke);
      player.smoke -= cleanAmount;
    } else {
      // 帮朋友
      const friend = room.players.find(p => p.name === targetPlayerName);
      if (!friend) { callback({ success: false, error: '找不到这个朋友' }); return; }
      const cleanAmount = Math.min(leafCount, friend.smoke);
      friend.smoke -= cleanAmount;
    }

    io.to(room.id).emit('leafUsed', { 
      from: player.name, 
      target: targetPlayerName, 
      count: leafCount,
      room: getRoomState(room) 
    });
    callback({ success: true, room: getRoomState(room) });
  });

  // 下一阶段
  socket.on('nextPhase', (callback) => {
    const room = rooms.get(currentRoom);
    if (!room) { callback({ success: false }); return; }

    room.phase++;
    if (room.phase >= PHASES.length) {
      room.phaseState = 'finished';
      // 计算最终得分
      const totalSmoke = room.players.reduce((sum, p) => sum + p.smoke, 0);
      let verdict, verdictKey;
      if (totalSmoke <= 20) {
        verdict = 'perfect'; verdictKey = '完美拯救';
      } else if (totalSmoke <= 30) {
        verdict = 'success'; verdictKey = '成功拯救';
      } else {
        verdict = 'fail'; verdictKey = '拯救失败';
      }

      const result = {
        totalSmoke,
        verdict,
        verdictKey,
        players: room.players.map(p => ({
          name: p.name,
          piece: p.piece,
          smoke: p.smoke,
          leaf: p.leaf,
          finalSmoke: p.smoke - p.leaf,
          choices: p.choices,
        })).sort((a, b) => a.finalSmoke - b.finalSmoke),
      };

      io.to(room.id).emit('gameFinished', result);
      callback({ success: true, result });
    } else {
      startPhase(room);
      callback({ success: true, room: getRoomState(room) });
    }
  });

  // 离开房间
  socket.on('leaveRoom', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      room.usedPieces = room.usedPieces.filter(id => id !== player.piece.id);
      room.usedNames = room.usedNames.filter(n => n !== player.name);
      room.players.splice(playerIndex, 1);

      // 如果是房主，换人
      if (room.host === socket.id && room.players.length > 0) {
        room.host = room.players[0].socketId;
      }

      // 如果房间没人了，删除
      if (room.players.length === 0) {
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('playerLeft', { 
          playerId: socket.id, 
          room: getRoomState(room),
          newHost: room.host 
        });
      }
    }
    socket.leave(currentRoom);
    currentRoom = null;
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('玩家断开:', socket.id);
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.usedPieces = room.usedPieces.filter(id => id !== player.piece.id);
          room.usedNames = room.usedNames.filter(n => n !== player.name);
          room.players.splice(playerIndex, 1);

          if (room.host === socket.id && room.players.length > 0) {
            room.host = room.players[0].socketId;
          }

          if (room.players.length === 0) {
            rooms.delete(currentRoom);
          } else {
            io.to(currentRoom).emit('playerLeft', { 
              playerId: socket.id, 
              room: getRoomState(room),
              newHost: room.host 
            });
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`云谷小镇服务器运行在 http://localhost:${PORT}`);
});
