$(function() {
    $('.api_prefix').val(localStorage.getItem('api_prefix'));
    $('.username').val(localStorage.getItem('username'));
    $('.password').val(localStorage.getItem('password'));

    $('.setting').on('submit', function(event) {
        var api_prefix = $('.api_prefix').val();
        var username = $('.username').val();
        var password = $('.password').val();
        if (!api_prefix || !username || !password) {
            $('.save').text('全項目を入力してください');
            return false;
        }

        localStorage.setItem('api_prefix', api_prefix);
        localStorage.setItem('username', username);
        localStorage.setItem('password', password);
        $('.save').text('保存しました');
        return false;
    });
});
