const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config.json');
const Discord = require('discord.js');
const client = new Discord.Client();
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => {
  console.log(`${client.user.tag} 로그인 되었습니다.`);
});

client.on('shardDisconnected', () => console.log('연결이 해제되었습니다. 다시 연결합니다...'));
client.on('shardReconnecting', id => console.log(`Shard with ID ${id} reconnected.`));

client.login(TOKEN);

client.on('message', async msg => {
  if (msg.author.bot) return undefined;
  if (!msg.content.startsWith(PREFIX)) return undefined;
  
  const args = msg.content.split(' ');
  const searchString = args.slice(1).join(' ');
  const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
  const serverQueue = queue.get(msg.guild.id);

  let command = msg.content.toLowerCase().split(' ')[0];
  command = command.slice(PREFIX.length);

 if(command === '재생'){
    const voiceChannel = msg.member.voice.channel;
    if(!voiceChannel) return msg.channel.send('먼저 음성채널에 들어가세요');
    const permissions = voiceChannel.permissionsFor(msg.client.user);
    if(!permissions.has('CONNECT')){
      return msg.channel.send('채널에 연결할 수 없습니다. \n권한을 확인하세요.')
    }
    if (!permissions.has('SPEAK')) {
			return msg.channel.send('말할 수 없습니다. \n권한을 확인하세요.');
    }
    
    if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); 
				await handleVideo(video2, msg, voiceChannel, true);
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** 추가!!`);
    } else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
🔥🔥🔥🔥🔥검색 결과🔥🔥🔥🔥🔥
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
🔥1~10 중 원하는 곡을 선택하세요.(10초)🔥
					`);
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							max: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send(err);
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 검색 결과가 없습니다');
				}
			}
			return handleVideo(video, msg, voiceChannel);
    }
  }
  else if (command === '다음') {
		if (!msg.member.voice.channel) return msg.channel.send('음성채널에 들어간 후 실행하십셔!!');
    if (!serverQueue) return msg.channel.send('리스트에 곡이 없습니다');
    
    serverQueue.connection.dispatcher.destroy();
    serverQueue.songs.shift();
    yPlay(msg.guild, serverQueue.songs[0]);
		return undefined;
  }
  else if(command === '나가'){
		if (!msg.member.voice.channel) return msg.channel.send('음성채널에 들어간 후 실행하십셔!!');
		if (!serverQueue) return msg.channel.send('There is nothing playing that I could stop for you.');
		serverQueue.songs = [];
    	serverQueue.connection.disconnect();
		return undefined;
  }
  else if (command === '볼륨') {
		if (!msg.member.voice.channel) return msg.channel.send('음성채널에 들어간 후 실행하십셔!!');
		if (!serverQueue) return msg.channel.send('리스트에 곡이 없습니다');
		if (!args[1]) return msg.channel.send(`🔊현재 볼륨 : **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`🔊볼륨 설정 : **${args[1]}**`);
	}
  else if (command === '현재곡') {
		if (!serverQueue) return msg.channel.send('리스트에 곡이 없습니다');
		return msg.channel.send(`🎶 현재 곡 : **${serverQueue.songs[0].title}**`);
	} 
  else if (command === '리스트') {
	try{
		if (!serverQueue) return msg.channel.send('리스트에 곡이 없습니다');
    
		return msg.channel.send(`
🚨곡 목록
${serverQueue.songs.map(song => `**📀** ${song.title}`).join('\n')}
\n
🎶현재 곡 : ${serverQueue.songs[0].title}
		`);
	} catch(error) {
		console.error(`에러: ${error}`);
		return msg.channel.send('리스트에 곡이 없습니다');
	}
  }
  else if (command === '정지') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ 일시정지');
		}
		return msg.channel.send('There is nothing playing.');
  } 
  else if (command === '시작') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ 다시 시작합니다');
		}
		return msg.channel.send('There is nothing playing.');
  }
  else if (command === '?'){
		return msg.channel.send(`
🔥🔥명령어🔥🔥
!재생 [유튜브링크]    💬 1)노래 재생 2)리스트에 저장
!재생 [검색어]        💬 유튜브 검색 상위 10개 출력 / 골라서 번호 입력
!정지   💬 곡 일시정지
!시작   💬 곡 다시 시작
!다음   💬 현재 곡 스킵
!나가   💬 노래 정지 후 음성채널에서 봇 나감(리스트 초기화)
!현재곡 💬 현재 곡 정보 출력
!리스트 💬 재생 리스트 출력
`
  );
}
  return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Discord.Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 3,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			yPlay(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`음성 채널에 들어갈 수 없습니다. error: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`음성 채널에 들어갈 수 없습니다. error: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
    else return msg.channel.send(`
✅ **${song.title}**
리스트에 추가합니다`);
	}
	return undefined;
}

function yPlay(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.play(ytdl(song.url, { filter: 'audioonly' }))
		.on('finish', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			yPlay(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 현재 곡: **${song.title}**`);
}


