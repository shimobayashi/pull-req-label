$(function() {
    function getConfig(type, key) {
        return localStorage.getItem(type + '-' + key);
    }
    function setConfig(type, key, value) {
        localStorage.setItem(type + '-' + key, value);
    }
    ['github', 'ghe'].forEach(function(type, i) {
        var $form = $('#form-'+type+'.setting');
        if (!$form.find('.api_prefix').val()) {
            $form.find('.api_prefix').val(getConfig(type, 'api_prefix'));
        }
        $form.find('.username').val(getConfig(type, 'username'));
        $form.find('.password').val(getConfig(type, 'password'));


        $form.on('submit', function(e) {
            var api_prefix = $form.find('.api_prefix').val();
            var username = $form.find('.username').val();
            var password = $form.find('.password').val();
            if (!api_prefix || !username || !password) {
                $form.find('.save').text('全項目を入力してください');
                return false;
            }

            setConfig(type, 'api_prefix', api_prefix);
            setConfig(type, 'username', username);
            setConfig(type, 'password', password);

            $form.find('.save').text('保存しました');
            return false;
        });
    });
});
