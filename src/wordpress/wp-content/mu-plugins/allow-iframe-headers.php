<?php

add_action( 'admin_init', 'remove_frame_options_header_hook', 1 );
add_action( 'login_init', 'remove_frame_options_header_hook', 1 );
function remove_frame_options_header_hook() {
	remove_action( current_filter(), 'send_frame_options_header', 10, 0 );
}
