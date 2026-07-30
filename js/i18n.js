/* ===== i18n (zh / ja only) ===== */
const I18N = {
    zh: {
        site_title: 'Hanabiの世界計畫成績簿',
        site_tagline: '個人歌曲成績記錄 ✦ 日台服更新情報',
        back_to_main: '← 返回 Hanabiの小天地',
        nav_intro: '關於遊戲', nav_characters: '角色美圖', nav_songs: '歌曲成績', nav_updates: '更新情報',

        intro_title: '✦ 關於世界計畫 ✦',
        intro_desc: '《世界計畫 繽紛舞台！ feat. 初音未來》是由 SEGA 與 Colorful Palette 開發的音樂節奏手遊，結合初音未來等 VOCALOID 角色與原創角色的故事。',
        intro_official_jp: '日服官方網站',
        intro_official_tw: '台服官方網站',
        units_title: '✦ 五大團隊 ✦',

        characters_title: '✦ 世界計畫角色美圖收藏 ✦',
        gallery_upload_btn: '📤 上傳圖片', gallery_empty: '還沒有收藏的圖片，點上方按鈕新增！',
        gallery_upload_done: '已新增圖片！',

        songs_title: '✦ 歌曲成績 ✦',
        songs_search_placeholder: '搜尋曲名...',
        songs_col_song: '曲名', songs_col_easy: 'Easy', songs_col_normal: 'Normal',
        songs_col_hard: 'Hard', songs_col_expert: 'Expert', songs_col_master: 'Master', songs_col_append: 'Append',
        stats_recorded: '已記錄', stats_avg_score: '平均分數',
        sort_title: '依曲名排序', sort_level_desc: '依等級（高到低）', sort_level_asc: '依等級（低到高）',
        filter_all: '全部歌曲', filter_recorded: '已記錄成績', filter_unrecorded: '尚未記錄',
        songs_loading: '載入歌曲資料中...', songs_load_fail: '歌曲資料載入失敗，稍後再試',
        songs_no_append: '—',

        score_modal_title: '記錄成績', score_modal_rank: '評級', score_modal_score: '分數',
        score_modal_fc: 'Full Combo 🟣', score_modal_ap: 'All Perfect 🌈',
        score_modal_save: '儲存', score_modal_cancel: '取消', score_modal_delete: '刪除記錄',
        score_modal_rank_none: '未選擇',
        score_modal_image: '成績截圖', score_modal_image_remove: '移除圖片',

        password_prompt: '請輸入密碼以進行修改：', password_wrong: '密碼錯誤！',
        password_set_prompt: '請設定成績簿密碼（留空則不設定密碼保護）：',
        password_confirm_prompt: '請再次輸入密碼確認：', password_mismatch: '兩次密碼不一致，設定取消',
        password_set_success: '密碼設定成功！', password_set_btn: '🔒 設定密碼',

        export_btn: '匯出成績', import_btn: '匯入成績',
        export_done: '已匯出成績！', import_done: '已匯入成績！', import_fail: '匯入失敗，請確認檔案格式正確',

        updates_title: '✦ 更新情報 ✦', updates_jp: '日服', updates_tw: '台服',
        updates_loading: '載入中...', updates_empty: '暫無更新資訊', updates_load_fail: '載入失敗，稍後再試',
        updates_view_original: '查看原文',
    },
    ja: {
        site_title: 'Hanabiのプロセカスコア帳',
        site_tagline: '個人楽曲スコア記録 ✦ 日台版アップデート情報',
        back_to_main: '← Hanabiの小天地に戻る',
        nav_intro: 'ゲーム紹介', nav_characters: 'キャラ画像', nav_songs: '楽曲スコア', nav_updates: '最新情報',

        intro_title: '✦ プロジェクトセカイについて ✦',
        intro_desc: '「プロジェクトセカイ カラフルステージ！ feat. 初音ミク」は、SEGAとColorful Paletteが開発した音楽リズムゲームです。初音ミクなどのVOCALOIDキャラクターとオリジナルキャラクターの物語が展開されます。',
        intro_official_jp: '日本版公式サイト',
        intro_official_tw: '台湾版公式サイト',
        units_title: '✦ 5つのユニット ✦',

        characters_title: '✦ プロセカキャラ画像コレクション ✦',
        gallery_upload_btn: '📤 画像をアップロード', gallery_empty: 'まだ画像がありません。上のボタンから追加しよう！',
        gallery_upload_done: '画像を追加しました！',

        songs_title: '✦ 楽曲スコア ✦',
        songs_search_placeholder: '曲名で検索...',
        songs_col_song: '曲名', songs_col_easy: 'Easy', songs_col_normal: 'Normal',
        songs_col_hard: 'Hard', songs_col_expert: 'Expert', songs_col_master: 'Master', songs_col_append: 'Append',
        stats_recorded: '記録済み', stats_avg_score: '平均スコア',
        sort_title: '曲名順', sort_level_desc: 'レベル（高い順）', sort_level_asc: 'レベル（低い順）',
        filter_all: 'すべての楽曲', filter_recorded: '記録済み', filter_unrecorded: '未記録',
        songs_loading: '楽曲データを読み込み中...', songs_load_fail: '楽曲データの読み込みに失敗しました',
        songs_no_append: '—',

        score_modal_title: 'スコアを記録', score_modal_rank: 'ランク', score_modal_score: 'スコア',
        score_modal_fc: 'Full Combo 🟣', score_modal_ap: 'All Perfect 🌈',
        score_modal_save: '保存', score_modal_cancel: 'キャンセル', score_modal_delete: '記録を削除',
        score_modal_rank_none: '未選択',
        score_modal_image: 'スコア画像', score_modal_image_remove: '画像を削除',

        password_prompt: 'パスワードを入力してください：', password_wrong: 'パスワードが違います！',
        password_set_prompt: 'スコア帳のパスワードを設定してください（空欄で保護なし）：',
        password_confirm_prompt: 'もう一度パスワードを入力してください：', password_mismatch: 'パスワードが一致しません。設定をキャンセルしました',
        password_set_success: 'パスワードを設定しました！', password_set_btn: '🔒 パスワード設定',

        export_btn: 'スコアをエクスポート', import_btn: 'スコアをインポート',
        export_done: 'エクスポートしました！', import_done: 'インポートしました！', import_fail: 'インポート失敗、ファイル形式をご確認ください',

        updates_title: '✦ 最新情報 ✦', updates_jp: '日本版', updates_tw: '台湾版',
        updates_loading: '読み込み中...', updates_empty: '情報がありません', updates_load_fail: '読み込みに失敗しました',
        updates_view_original: '元記事を見る',
    }
};

let siteLang = localStorage.getItem('sekai_lang') || 'zh';

function applyLang(lang) {
    siteLang = lang;
    localStorage.setItem('sekai_lang', lang);
    document.documentElement.lang = lang;
    const dict = I18N[lang] || I18N.zh;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.placeholder = dict[key];
    });
    document.querySelectorAll('.lang-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    if (dict.site_title) document.title = dict.site_title;
    if (typeof refreshDynamicContent === 'function') refreshDynamicContent();
}

function setSiteLang(lang) {
    applyLang(lang);
}

function t(key, params) {
    const str = (I18N[siteLang] || I18N.zh)[key] || I18N.zh[key] || key;
    if (!params) return str;
    return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);
}
