import React from 'react';

type SelectorProps = {
	name: string;
	versions: string[];
	onChange: (version: string) => void;
};

export default function PHPSelector(props: SelectorProps) {
	return (
		<select
			id={props.name + '-version'}
			onChange={(event) => {
				props.onChange(event.target.value);	
			}}
		>
			{props.versions.map((value) => (
				<option
					selected={
						new URL(window.location.toString()).searchParams.get(
							props.name
						) === value
					}
					value={value}
				>
					{props.name.toString() + ' ' + value}
				</option>
			))}
		</select>
	);
}
